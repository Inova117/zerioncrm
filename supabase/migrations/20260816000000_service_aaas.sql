-- Añade 'aaas' (AI agents / empleado digital) al enum de servicios del CRM.
-- Solo ADD VALUE, sin UPDATE en la misma transacción (pitfall 55P04: un valor
-- de enum nuevo no puede usarse en la misma transacción que lo agrega).
alter type service_t add value if not exists 'aaas';
