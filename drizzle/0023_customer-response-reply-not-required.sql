-- Use when status is "waiting for contact" but no customer reply is needed — excluded from follow-up / no-response lists.
ALTER TYPE "customer_response_status" ADD VALUE 'reply_not_required';
