<?php
declare(strict_types=1);

const CONTACT_WEBHOOK_SECRET = 'SET_THIS_ON_SEOHOST';
const FROM_EMAIL = 'pmodlinski@ezoteva.com';
const FROM_NAME = 'Quantum Forge Studio';
const PRIMARY_RECIPIENT = 'pmodlinski@ezoteva.com';

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function header_value(string $value): string
{
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

function encoded_header(string $value): string
{
    $value = header_value($value);
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($value, 'UTF-8', 'B', "\r\n");
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function get_authorization_header(): string
{
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return (string) $_SERVER['HTTP_AUTHORIZATION'];
    }

    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $name => $value) {
            if (strtolower((string) $name) === 'authorization') {
                return (string) $value;
            }
        }
    }

    return '';
}

function clean_text(mixed $value, int $limit = 3000): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = trim(str_replace("\0", '', $value));
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $limit, 'UTF-8');
    }

    return substr($value, 0, $limit);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
}

$expected = 'Bearer ' . CONTACT_WEBHOOK_SECRET;
if (!hash_equals($expected, get_authorization_header())) {
    respond(401, ['ok' => false, 'message' => 'Unauthorized.']);
}

$rawBody = file_get_contents('php://input') ?: '';
$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    respond(400, ['ok' => false, 'message' => 'Invalid JSON.']);
}

$data = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;

$name = clean_text($data['name'] ?? '', 160);
$email = clean_text($data['email'] ?? '', 160);
$message = clean_text($data['message'] ?? '', 5000);
$source = clean_text($data['source'] ?? 'quantumforgestudio.com', 180);
$submittedAt = clean_text($data['submittedAt'] ?? $data['createdAt'] ?? gmdate('c'), 80);

if ($name === '' || $email === '' || $message === '') {
    respond(422, ['ok' => false, 'message' => 'Missing required fields.']);
}

if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    respond(422, ['ok' => false, 'message' => 'Invalid customer email.']);
}

$subject = 'Brief ze strony Quantum Forge Studio - ' . $name;
$body = implode("\n", [
    'Nowy brief z formularza Quantum Forge Studio',
    '',
    'Imie i nazwisko: ' . $name,
    'E-mail zwrotny: ' . $email,
    '',
    'Wiadomosc / zakres:',
    $message,
    '',
    'Zrodlo: ' . $source,
    'Wyslano: ' . $submittedAt,
]);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: ' . encoded_header(FROM_NAME) . ' <' . FROM_EMAIL . '>',
    'Reply-To: ' . header_value($name) . ' <' . header_value($email) . '>',
    'X-Mailer: PHP/' . phpversion(),
];

$ok = mail(
    PRIMARY_RECIPIENT,
    encoded_header($subject),
    $body,
    implode("\r\n", $headers),
    '-f' . FROM_EMAIL
);

if (!$ok) {
    respond(502, ['ok' => false, 'message' => 'Mail delivery failed.']);
}

respond(200, ['ok' => true, 'message' => 'Dziekujemy. Brief zostal wyslany.']);
