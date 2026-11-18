# Guía definitiva de sustentación — cuatro experimentos

Uso: defensa oral. Si falta evidencia → **PENDIENTE** (no inventar).  
**Unidades Exp4:** coma decimal ES → `3,629 s` = **3.629 s**.

---

## A. Preguntas Exp. 4 (mínimo 15)

**1. ¿Qué es RPO en la metodología de Samuel?**  
RPO **observado** = `t_fallo − t_backup` del backup **restaurado** (ms en `metrics.json`). No es el intervalo objetivo (300 s / 30 s).

**2. ¿Qué es RTO?**  
RTO **observado** = `t_servicio_ok − t_fallo`. En R0 incluye la espera del operador para el restore manual.

**3. ¿Qué es MTTD aquí?**  
`t_deteccion − t_fallo` (alerta `lab_event_observed`). R0: 0.300 s; R1: 0.109 s.

**4. ¿Qué hace el backup?**  
`mysqldump` + manifiesto SHA256 (`backup.meta.json`). Intervalo objetivo distinto R0/R1; el RPO medido es la antigüedad al fallo.

**5. ¿R0 vs R1 en restauración?**  
R0: restore **manual** real (runner espera script). R1: restore **automatizado** (G2) + chequeos.

**6. ¿Integridad PASS qué garantiza?**  
Servicio/DB/consulta OK, conteo = esperado del backup, sin corrupción sospechada. **No** implica cero pérdida de datos.

**7. ¿Cuántos commits se perdieron?**  
R0: 6 de 16. R1: 3 de 16. Pérdida post-backup = RPO, no corrupción del restore.

**8. ¿Cómo comparar R0/R1?**  
Misma carga (16 commits / mismos seq). R1 añade G1 (backup mid) y G2 (auto-restore). n=1 pareja.

**9. ¿Para qué G1?**  
Backup adicional mid → backup restaurado más reciente → menor RPO observado (3.629→2.209 s).

**10. ¿Para qué G2?**  
Restore automático + integridad + sonda → elimina espera humana → menor RTO (13.056→1.792 s).

**11. ¿Qué fallo se simuló?**  
Pérdida/corrupción lógica controlada tras escrituras sintéticas en lab OCI VM (no afirmar ransomware “real” sin evidencia de ataque verdadero).

**12. ¿Riesgos residuales?**  
Aún hay commits perdidos; n=1; incertidumbre de sonda (~1 s) en `t_servicio_ok`; evidencias públicas sin dumps privados.

**13. ¿Límites de la prueba?**  
Una pareja R0/R1; lab aislado; no garantiza producción ni estadística; originales no sanitizados no están en GitHub.

**14. ¿Resultados numéricos a memorizar?**  
RPO 3.629/2.209 s (−39.1%); RTO 13.056/1.792 s (−86.3%); MTTD 0.300/0.109 s; commits 10/16 vs 13/16; integrity/recovery PASS.

**15. ¿Qué evidencias mostrar al profesor?**  
`metrics.json` R0/R1, `RESULTADOS-OCI-20261118.md`, `06-metricas-rpo-rto.md`, `05-r0-r1-g1-g2.md`, commit `d5e72f6e`, y la auditoría IA si preguntan por el LLM.

**16. (bonus) ¿RPO = RTO?** → **No.** Uno mide pérdida temporal de datos (antigüedad backup); el otro tiempo hasta servicio OK.

---

## B. Preguntas integradoras (≥15)

**1. ¿Cómo se articula defensa en profundidad en el grupo?**  
Capas: identidad/honeytoken (AWS), segmentación L4 (OCI), telemetría (GCP), resiliencia datos (OCI), más HITL local (T2).

**2. ¿Zero Trust en una frase?**  
Nunca confiar solo por perímetro: evaluar cada invoke/token/path y decidir continuamente (SP 800-207).

**3. ¿Honeytoken vs reuse?**  
`identity.honeytoken_use` (canary) ≠ `identity.reuse_detected` (token reutilizado). Ambos pueden coexistir.

**4. ¿Por qué Exp2 no “arregla” OKE?**  
Lab Docker + gateway L4; README niega NetworkPolicy en producción OKE.

**5. ¿Por qué falló la primera R1 de telemetría en GKE?**  
`rollout restart` cambió `instanceId`; métrica by-instance quedó inválida. Retest con flags en volumen.

**6. ¿MTTD vs MTTC vs restore (Exp3)?**  
Detección − inyección; contención − inyección; restore es distinto (Exp3 R1: 7.51 / 148.1 / 118 s).

**7. ¿Integrity PASS y RPO pueden coexistir?**  
Sí (Exp4): restore íntegro del backup, pero commits posteriores al backup se pierden.

**8. ¿Qué aporta la IA defensiva?**  
Narrativa y contraste; **nunca** sustituye métricas. Auditoría humana clasifica claims.

**9. ¿Qué errores típicos del LLM evitamos?**  
Confundir honey/reuse; afirmar SIEM; 16/16 commits; RPO=0 por integrity; NP OKE; inventar ts.

**10. ¿T1 honeytoken está “en SIEM”?**  
No demostrado. Detección local `securityEvent` (not CloudWatch).

**11. ¿T2 toca la nube?**  
No. Flag local + aprobación humana; `cloudTouched=false`.

**12. ¿Cuál es la mejora RPO/RTO del grupo?**  
Exp4: −39.1% RPO y −86.3% RTO en n=1 (Samuel).

**13. ¿Qué evidencias priorizar en 10 páginas?**  
Tabla de 4 experimentos + 2 tendencias + limitaciones + 1 figura/tabla de métricas Exp3/Exp4.

**14. ¿Qué no debe decir el estudiante?**  
“Recuperamos todo”, “garantizado”, “SIEM alertó el honeytoken”, “NP en OKE”, “Exp3 rompió DevOps”.

**15. ¿Cómo citar fuentes?**  
Commit + ruta: Exp4 `d5e72f6e` `evidencias-publicas/.../metrics.json`; Exp3 FINAL-REPORT retest; Exp1 paquete honeytoken; Exp2 summaries públicos.

**16. (bonus) ¿Por qué n=1 importa?**  
Una pareja no es muestra estadística; se reporta como resultado experimental puntual.

---

## C. Recordatorios por experimento (corto)

- **Exp1:** 403 honey; no SIEM; MTTD 398 ms = reuse.  
- **Exp2:** R1 20 ms; Docker≠OKE NP.  
- **Exp3:** R1 partial 7.51/148.1; identidad estable.  
- **Exp4:** RPO/RTO/MTTD arriba; G1/G2; integrity≠cero pérdida.
