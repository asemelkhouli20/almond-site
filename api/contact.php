<?php
// PHP 7.4+ with cURL. Configuration comes exclusively from PHP-FPM environment.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'code' => 'method']);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) respond(413, ['ok' => false, 'code' => 'too_large']);
if (!is_string($_POST['_gotcha'] ?? '') || ($_POST['_gotcha'] ?? '') !== '') respond(422, ['ok' => false, 'code' => 'spam']);
$limits = ['name' => [2,180], 'company' => [2,180], 'email' => [1,180], 'phone' => [7,40], 'type' => [1,180], 'message' => [15,4000]];
$data = [];
foreach ($limits as $field => [$min, $max]) {
    $raw = $_POST[$field] ?? null;
    // Count UTF-16 code units, matching HTML maxlength and JavaScript String.length.
    $length = is_string($raw) ? preg_match_all('/[\x{10000}-\x{10FFFF}]|./us', $raw, $matches) : false;
    if ($length !== false) foreach ($matches[0] as $character) if (strlen($character) === 4) $length++;
    $value = is_string($raw) ? trim($raw) : '';
    $trimLength = preg_match_all('/./us', $value);
    if ($length === false || $length > $max || $trimLength === false || $trimLength < $min) respond(422, ['ok' => false, 'code' => 'validation', 'field' => $field]);
    $data[$field] = $value;
}
if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/u', $data['email']) || !preg_match('/^[+()\d\s.-]{7,40}$/', $data['phone'])) respond(422, ['ok' => false, 'code' => 'validation']);
$url = getenv('ALMOND_APPS_SCRIPT_URL') ?: '';
$token = getenv('ALMOND_CONTACT_RELAY_TOKEN') ?: '';
if (!preg_match('~^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$~D', $url) || !$token || !function_exists('curl_init')) respond(503, ['ok' => false, 'code' => 'configuration']);
$data['relay_token'] = $token;
$data['_gotcha'] = '';
$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($data),
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 30,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
]);
// cURL follows Google's ContentService redirect as GET, without resending the POST.
$body = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);
$result = is_string($body) ? json_decode($body, true) : null;
if (is_array($result)) {
    error_log(
        '[Almond Contact] Apps Script result code: ' .
        substr((string)($result['code'] ?? 'none'), 0, 80)
    );
}
if ($status !== 200 || !is_array($result)) respond(502, ['ok' => false, 'code' => 'upstream']);
if (($result['ok'] ?? null) !== true || ($result['saved'] ?? null) !== true) {
    $code = $result['code'] ?? '';
    respond(in_array($code, ['validation', 'spam'], true) ? 422 : 502, ['ok' => false, 'code' => 'upstream_rejected']);
}
respond(200, ['ok' => true, 'saved' => true]);
