
<?php

declare(strict_types=1);

/**
 * Almond.sa — Contact Form PHP Relay
 *
 * Receives contact form submissions and forwards
 * them to Google Apps Script.
 *
 * PHP-FPM environment variables:
 *   ALMOND_APPS_SCRIPT_URL
 *   ALMOND_CONTACT_RELAY_TOKEN
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// --------------------------------------------------
// JSON RESPONSE
// --------------------------------------------------

function respond(int $status, array $body): void
{
    http_response_code($status);

    echo json_encode(
        $body,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}

// --------------------------------------------------
// UTF-16 LENGTH (MATCHES JAVASCRIPT LENGTH)
// --------------------------------------------------

function utf16Length(string $value)
{
    $count = preg_match_all(
        '/[\x{10000}-\x{10FFFF}]|./us',
        $value,
        $matches
    );

    if ($count === false) {
        return false;
    }

    foreach ($matches[0] as $character) {
        if (strlen($character) === 4) {
            $count++;
        }
    }

    return $count;
}

// --------------------------------------------------
// REQUEST METHOD
// --------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');

    respond(405, [
        'ok' => false,
        'code' => 'method'
    ]);
}

// --------------------------------------------------
// REQUEST SIZE
// --------------------------------------------------

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) {
    respond(413, [
        'ok' => false,
        'code' => 'too_large'
    ]);
}

// --------------------------------------------------
// HONEYPOT SPAM PROTECTION
// --------------------------------------------------

$honeypot = $_POST['_gotcha'] ?? '';

if (!is_string($honeypot) || $honeypot !== '') {
    respond(422, [
        'ok' => false,
        'code' => 'spam'
    ]);
}

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

$limits = [
    'name'    => [2, 180],
    'company' => [2, 180],
    'email'   => [1, 180],
    'phone'   => [7, 40],
    'type'    => [1, 180],
    'message' => [15, 4000]
];

$data = [];

foreach ($limits as $field => [$min, $max]) {
    $raw = $_POST[$field] ?? null;

    if (!is_string($raw)) {
        respond(422, [
            'ok' => false,
            'code' => 'validation',
            'field' => $field
        ]);
    }

    $value = trim($raw);

    $rawLength = utf16Length($raw);
    $trimLength = utf16Length($value);

    if (
        $rawLength === false ||
        $trimLength === false ||
        $rawLength > $max ||
        $trimLength < $min
    ) {
        respond(422, [
            'ok' => false,
            'code' => 'validation',
            'field' => $field
        ]);
    }

    $data[$field] = $value;
}

// --------------------------------------------------
// EMAIL VALIDATION
// --------------------------------------------------

if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    respond(422, [
        'ok' => false,
        'code' => 'validation',
        'field' => 'email'
    ]);
}

// --------------------------------------------------
// PHONE VALIDATION
// --------------------------------------------------

if (!preg_match('/^[+()\d\s.-]{7,40}$/', $data['phone'])) {
    respond(422, [
        'ok' => false,
        'code' => 'validation',
        'field' => 'phone'
    ]);
}

// --------------------------------------------------
// GOOGLE APPS SCRIPT CONFIGURATION
// --------------------------------------------------

$url = getenv('ALMOND_APPS_SCRIPT_URL') ?: '';
$token = getenv('ALMOND_CONTACT_RELAY_TOKEN') ?: '';

$validUrl = preg_match(
    '~^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$~D',
    $url
);

if (!$validUrl) {
    error_log('[Almond Contact] Invalid Apps Script URL');

    respond(503, [
        'ok' => false,
        'code' => 'configuration'
    ]);
}

if ($token === '') {
    error_log('[Almond Contact] Missing relay token');

    respond(503, [
        'ok' => false,
        'code' => 'configuration'
    ]);
}

if (!function_exists('curl_init')) {
    error_log('[Almond Contact] PHP cURL unavailable');

    respond(503, [
        'ok' => false,
        'code' => 'configuration'
    ]);
}

// --------------------------------------------------
// PREPARE GOOGLE REQUEST
// --------------------------------------------------

// Authentication token
$data['relay_token'] = $token;

// Honeypot must remain empty
$data['_gotcha'] = '';

// Unique request identifier for debugging
$data['trace_id'] = bin2hex(random_bytes(8));

// URL-encoded form data, compatible with
// Google Apps Script e.parameter
$postBody = http_build_query(
    $data,
    '',
    '&',
    PHP_QUERY_RFC1738
);

// --------------------------------------------------
// SAFE DIAGNOSTIC LOGGING
// --------------------------------------------------

// Never log raw tokens or customer information.
error_log('[Almond Outbound] ' . json_encode([
    'trace_id' => $data['trace_id'],
    'fields' => array_keys($data),
    'token_length' => strlen($token),
    'token_fingerprint' => substr(
        hash('sha256', $token),
        0,
        16
    ),
    'body_has_token' => strpos(
        $postBody,
        'relay_token='
    ) !== false,
    'body_bytes' => strlen($postBody)
]));

// --------------------------------------------------
// SEND REQUEST TO GOOGLE APPS SCRIPT
// --------------------------------------------------

$curl = curl_init($url);

curl_setopt_array($curl, [
    CURLOPT_POST => true,

    CURLOPT_POSTFIELDS => $postBody,

    CURLOPT_HTTPHEADER => [
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json'
    ],

    CURLOPT_RETURNTRANSFER => true,

    // Google ContentService redirects responses
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,

    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 40,

    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,

    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
]);

$body = curl_exec($curl);

$status = (int) curl_getinfo(
    $curl,
    CURLINFO_HTTP_CODE
);

$curlError = curl_errno($curl);

curl_close($curl);

// --------------------------------------------------
// HANDLE NETWORK ERRORS
// --------------------------------------------------

if ($body === false || $curlError !== 0) {
    error_log('[Almond Contact] Network error: ' . json_encode([
        'trace_id' => $data['trace_id'],
        'curl_errno' => $curlError,
        'http_status' => $status
    ]));

    respond(502, [
        'ok' => false,
        'code' => 'upstream'
    ]);
}

// --------------------------------------------------
// PARSE GOOGLE RESPONSE
// --------------------------------------------------

$result = json_decode($body, true);

if ($status !== 200 || !is_array($result)) {
    error_log('[Almond Contact] Invalid Google response: ' . json_encode([
        'trace_id' => $data['trace_id'],
        'http_status' => $status,
        'valid_json' => is_array($result)
    ]));

    respond(502, [
        'ok' => false,
        'code' => 'upstream'
    ]);
}

// --------------------------------------------------
// LOG GOOGLE RESULT
// --------------------------------------------------

$resultCode = (string) ($result['code'] ?? 'none');

error_log('[Almond Contact] Google result: ' . json_encode([
    'trace_id' => $data['trace_id'],
    'http_status' => $status,
    'result_code' => substr($resultCode, 0, 80),
    'ok' => $result['ok'] ?? false,
    'saved' => $result['saved'] ?? false
]));

// --------------------------------------------------
// HANDLE GOOGLE REJECTION
// --------------------------------------------------

if (
    ($result['ok'] ?? null) !== true ||
    ($result['saved'] ?? null) !== true
) {
    $responseStatus = in_array(
        $resultCode,
        ['validation', 'spam'],
        true
    ) ? 422 : 502;

    respond($responseStatus, [
        'ok' => false,
        'code' => 'upstream_rejected'
    ]);
}

// --------------------------------------------------
// SUCCESS
// --------------------------------------------------

respond(200, [
    'ok' => true,
    'saved' => true
]);
