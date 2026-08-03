# 06 — Riesgos y Compliance

> Verificado 2026-07-14 contra fuentes primarias (FTC, Google, Microsoft, Yahoo, gdpr-info, Google Maps ToS, Instantly ToS). Confirmado por pase adversarial.

## 1. Legal — email frío a EE.UU. (CAN-SPAM)

**El cold email B2B sin consentimiento previo es LEGAL en EE.UU.** — CAN-SPAM no tiene excepción B2B y no exige opt-in. Multa hasta **$53,088 por email** que incumpla. ([Guía FTC](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business))

**Checklist obligatoria por email (se implementa en la plantilla de Instantly, día 14):**
1. From veraz: nombre real + ZerionStudio. Sin "Re:"/"Fwd:" falsos en el subject.
2. Naturaleza comercial evidente por el contenido.
3. **Dirección postal física válida en el footer.** La del founder en Ecuador sirve según el texto de la ley (ASSUMPTION: la FTC no aclara direcciones extranjeras explícitamente; opción cero-ambigüedad: virtual mailbox US/CMRA ~$10-30/mes — el headroom del presupuesto lo absorbe).
4. Opt-out en lenguaje claro, **en el idioma del email** («responde "no gracias" y no te escribo más»), funcional ≥30 días.
5. Procesamiento del opt-out: máximo legal 10 días hábiles → **nosotros: mismo día, automatizado** (tabla `suppression`, consultada SIEMPRE por el exportador). La lista de supresión jamás se comparte.

## 2. Legal — GDPR y LOPDP

- **GDPR NO aplica** apuntando solo a negocios en EE.UU./LATAM desde Ecuador (Art. 3(2) exige targets en la UE). **Regla operativa: cero targets UE durante la validación** — el filtro de geos de los perfiles lo garantiza.
- **Ecuador LOPDP** aplica al operador como responsable domiciliado en Ecuador (Superintendencia de Protección de Datos; multas hasta 1% de facturación): aviso de privacidad en el sitio nombrando a ZerionStudio como responsable, minimización (solo datos de contacto de negocio), borrado el mismo día ante solicitud. (ASSUMPTION: base de interés legítimo del Art. 7 no verificada contra el texto oficial; la postura adoptada es segura bajo cualquier lectura.)

## 3. ToS de fuentes de datos

| Fuente | Riesgo | Postura |
|---|---|---|
| Google Maps vía Apify/Outscraper | Scrapear Maps viola el ToS de Google ("Customer will not export, extract, or otherwise scrape Google Maps Content"). PERO: hiQ v. LinkedIn (9º Cir. 2022) estableció que scrapear datos públicos probablemente NO viola la CFAA — el riesgo residual es contractual y recae principalmente en el **vendor** (Apify/Outscraper), no en el comprador. Sin enforcement conocido contra compradores a escala SMB. | ACEPTADO con mitigaciones: nunca scrapear con cuenta Google propia; nunca republicar contenido de Google (nombres/reviews solo como insumo interno del LLM); los reviews jamás aparecen citados textualmente en emails. |
| Google Places API oficial | Prohíbe almacenar todo excepto `place_id` (lat/lng cacheable 30 días — corrección adversarial). Violarlo en cuenta propia facturada = riesgo de terminación. | **RECHAZADA** como fuente de base de datos. |
| PSI API / Serper / Brave | Servicios diseñados para este uso. | Sin riesgo material. |
| Instantly ToS | Cold B2B permitido; opt-out obligatorio; **reventa de datos = breach no-curable**; listas compradas viejas = spam traps → suspensión. | Cumplimos: scrape fresco + verificación Reoon + opt-out + nunca revender. |
| Google Workspace AUP | Prohíbe técnicamente el email masivo no solicitado; es a la vez el estándar de facto de los practicantes (~87% inbox placement). | ACEPTADO como riesgo consciente: volúmenes chicos (≤25/día/buzón), dominios secundarios — el dominio principal zerionstudio.com jamás envía frío. Peor caso: suspensión de buzones secundarios → reemplazo en 48h. |
| Meta / WhatsApp | API de WhatsApp Business exige opt-in para mensajes iniciados por el negocio → **NO-GO para frío**. | Solo wa.me manual desde la app WhatsApp Business (número dedicado, 10-20/día, warmed). |

## 4. Deliverability (donde mueren los sistemas de cold email)

**Reglas de plataformas (verificadas):**
- Google (feb-2024, enforcement desde nov-2025): TODO sender necesita SPF o DKIM, rDNS, TLS, spam <0.3%. Senders de 5,000+/día a Gmail: SPF+DKIM+DMARC alineado + one-click unsubscribe RFC 8058. **Estamos a ~2% de ese umbral, pero implementamos el stack completo igual** (día 1).
- Microsoft (desde 5-may-2025): 5,000+/día a outlook/hotmail/live → SPF+DKIM+DMARC alineado; rechazo directo `550 5.7.515` (corrección adversarial: se saltaron la fase de junk).
- Yahoo: sin umbral numérico publicado; mismo stack.

**Arquitectura de envío:** 2 dominios lookalike (301→principal) × 2 buzones = 4 buzones. Día 0: SPF, DKIM 2048, DMARC p=none con rua (→p=quarantine ~semana 8). Semanas 1-2: SOLO warmup. Ramp: 5→10→15→20→22/día/buzón (semanas 3-7) hasta ~88/día. Nunca subir >20%/día por buzón. Límite oficial Workspace: 2,000/día/user — nuestro techo es el 1.1% de eso.

**Monitoreo (dashboard + rutina semanal):**
- Google Postmaster Tools: spam <0.1% objetivo; **0.3% = parada dura → volumen a la mitad inmediatamente**.
- Bounce <2% (heurística de industria, no cifra oficial de Google); **a 3% → pausar campaña y re-verificar la lista**.
- MXToolbox blacklist check semanal (100+ DNSBLs, gratis).
- Catch-alls (grado C) aislados en campaña propia en dominio secundario; pausa si su bounce >5%.
- Mes 2: agregar 1 buzón Microsoft 365 en tercer dominio (diversidad de proveedor).

## 5. EL modo de fallo más probable + mitigación

**No es deliverability (está sobre-mitigada arriba). Es que la tasa de respuesta real aterrice en o bajo el promedio de plataforma (≈3.4% por lead) en lugar del caso base (6.0%), porque no existe benchmark para nuestro ICP exacto (es/en, SMB local, LATAM/hispano) y el pitch "dev shop" es una categoría saturada.**

Consecuencia si pasa: ~6 llamadas/mes en lugar de 10-13 a 70 leads/día — el sistema sigue siendo 17× ROI-positivo, pero falla la meta.

**Mitigación (ya integrada en el diseño):**
1. **Regla de las 500 entregas** (~día 17 de envío): reemplazar tasas asumidas por medidas. Si reply <3.5% → congelar volumen y arreglar copy/targeting/nicho. Prohibido compensar mal copy con más buzones.
2. Palancas de reply documentadas y gratis: personalización profunda (+52%), micro-lotes ≤50 por nicho/geo (2.76×), idioma correcto por lead, hook del segmento no-website.
3. Plan de capacidad pre-calculado para el downside: 119 leads/día, 6 buzones, ~$17/llamada — decisión de 1 día, no de re-arquitectura.
4. Canal WhatsApp del segmento no-website (+3-6 llamadas/mes) desacoplado del riesgo de email.

## 6. Riesgos secundarios

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Cap de 1,000 contactos de Instantly se vuelve molesto | Media | Bajo ($50/mes) | Prune semanal confirmado como viable; triggers de upgrade definidos (reporte 05) |
| Apify cambia precios o el actor se rompe | Baja | Medio | Interfaz `LeadSource`; Outscraper como fallback a 1 día de trabajo |
| Suspensión de buzones Workspace (AUP) | Baja-media | Medio | Dominios secundarios desechables; volúmenes mínimos; reemplazo 48h; mes 2 diversificar a M365 |
| Falsos positivos del auditor (citar una "falla" que no existe) | Media | Alto (mata credibilidad) | Re-verificar cada finding citado <24h antes del envío; QA humano del batch; asserts conservadores en socials muertos |
| Agotamiento del pool de nichos (~4-5 meses medidos) | Alta (certeza) | Medio | Calendario de expansión medido: Dallas GC mes 3, Miami paisajistas mes 4, tercer vertical activo mes 5 |
| Capacidad del founder (llamadas + delivery + pipeline) | Media | Alto | El sistema degrada con gracia: bajar leads/día es un parámetro de perfil |
