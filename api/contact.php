<?php
declare(strict_types=1);

/**
 * Almond.sa contact form relay (PHP 8.3)
 *
 * Configure in the PHP-FPM pool environment:
 *   ALMOND_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 *   ALMOND_CONTACT_RELAY_TOKEN=<secret matching Apps Script property>
 *
 * Receives form-urlencoded POSTs from the existing website and forwards them
 * to Apps Script. Returns success only if Google confirms the row was saved.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Count UTF-16 code units, matching JavaScript String.length. */
function utf16_length(string $value): int|false
{
    $characters = [];
    $count = preg_match_all('/[\x{10000}-\x{10FFFF}]|./us', $value, $characters);
    if ($count === false) {
        return false;
    }
    foreach ($characters[0] as $character) {
        if (strlen($character) === 4) {
            ++$count;
        }
    }
    return $count;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'code' => 'method']);
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) {
    respond(413, ['ok' => false, 'code' => 'too_large']);
}

$honeypot = $_POST['_gotcha'] ?? '';
if (!is_string($honeypot) || $honeypot !== '') {
    respond(422, ['ok' => false, 'code' => 'spam']);
}

$limits = [
    'name'    => [2, 180],
    'company' => [2, 180],
    'email'   => [1, 180],
    'phone'   => [7, 40],
    'type'    => [1, 180],
    'message' => [15, 4000],
];

$data = [];
foreach ($limits as $field => [$minimum, $maximum]) {
    $raw = $_POST[$field] ?? null;
    if (!is_string($raw)) {
        respond(422, ['ok' => false, 'code' => 'validation', 'field' => $field]);
    }

    $value = trim($raw);
    $rawLength = utf16_length($raw);
    $trimmedLength = utf16_length($value);
    if ($rawLength === false || $trimmedLength === false || $rawLength > $maximum || $trimmedLength < $minimum) {
        respond(422, ['ok' => false, 'code' => 'validation', 'field' => $field]);
    }
    $data[$field] = $value;
}

if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/u', $data['email'])) {
    respond(422, ['ok' => false, 'code' => 'validation', 'field' => 'email']);
}
if (!preg_match('/^[+()\d\s.-]{7,40}$/', $data['phone'])) {
    respond(422, ['ok' => false, 'code' => 'validation', 'field' => 'phone']);
}

$url = getenv('ALMOND_APPS_SCRIPT_URL') ?: '';
$token = getenv('ALMOND_CONTACT_RELAY_TOKEN') ?: '';

if (!preg_match('~^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$~D', $url)) {
    error_log('[Almond Contact] Invalid Apps Script URL');
    respond(503, ['ok' => false, 'code' => 'configuration']);
}
if ($token === '') {
    error_log('[Almond Contact] Missing relay token');
    respond(503, ['ok' => false, 'code' => 'configuration']);
}
if (!function_exists('curl_init')) {
    error_log('[Almond Contact] PHP cURL not installed');
    respond(503, ['ok' => false, 'code' => 'configuration']);
}

$data['relay_token'] = $token;
$data['_gotcha'] = '';
$data['trace_id'] = bin2hex(random_bytes(8));
$postBody = http_build_query($data, '', '&', PHP_QUERY_RFC1738);

// Diagnostic metadata only; never log tokens or submitted personal data.
error_log('[Almond Outbound] ' . json_encode([
    'trace_id' => $data['trace_id'],
    'token_length' => strlen($token),
    'body_has_token' => strpos($postBody, 'relay_token=') !== false,
    'body_bytes' => strlen($postBody),
]));

$curl = curl_init($url);
if ($curl === false) {
    respond(502, ['ok' => false, 'code' => 'upstream']);
}

curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postBody,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$body = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_errno($curl);
curl_close($curl);

if (!is_string($body) || $curlError !== 0) {
    error_log('[Almond Contact] Google network error; trace=' . $data['trace_id'] . ' curl_errno=' . $curlError);
    respond(502, ['ok' => false, 'code' => 'upstream']);
}

$result = json_decode($body, true);
if ($status !== 200 || !is_array($result)) {
    error_log('[Almond Contact] Invalid Google response; trace=' . $data['trace_id'] . ' http=' . $status);
    respond(502, ['ok' => false, 'code' => 'upstream']);
}

if (($result['ok'] ?? null) !== true || ($result['saved'] ?? null) !== true) {
    $code = is_string($result['code'] ?? null) ? substr($result['code'], 0, 80) : 'unknown';
    error_log('[Almond Contact] Apps Script result code: ' . $code . '; trace=' . $data['trace_id']);
    respond(in_array($code, ['validation', 'spam'], true) ? 422 : 502, [
        'ok' => false,
        'code' => 'upstream_rejected',
    ]);
}

respond(200, ['ok' => true, 'saved' => true]);
