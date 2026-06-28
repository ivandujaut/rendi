-- =====================================================================
-- 03_seed.sql  ·  Migracion del banco Modelo OATec 2026 (40 preguntas)
-- Ejecutar DESPUES de 01_schema.sql y 02_rls.sql.
-- Las figuras se referencian por nombre; subi los .jpg al bucket 'figs'
-- de Supabase Storage (ver SETUP.md).
-- =====================================================================

insert into public.exams (id, title, year, duration_min, shuffle, student_review, pass_mark, is_published)
values ('00000000-0000-0000-0000-000000000026',
        'Examen Modelo OATec 2026', 2026, 40, true, false, 60, true)
on conflict (id) do nothing;

-- Q1
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 1, 'Química',
          '¿Cuál de las siguientes opciones representa una propiedad intensiva de la materia?', null, '["El volumen de una muestra de agua.","El peso de un lingote de oro.","La temperatura de ebullición del alcohol.","La longitud de un cable de cobre.","La masa de un bloque plástico."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q2
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 2, 'Lógica y estimación',
          'En una habitación de 2,6 m de altura se construye una biblioteca de base 66 cm y altura (h). Luego se la levantará pivotando sobre uno de sus vértices inferiores para apoyarla contra la pared. ¿Cuál es el máximo valor posible de (h) para que no toque el techo?', null, '["1,94 m.","2,51 m.","2,60 m.","No puede determinarse.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q3
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 3, 'Física: Térmica',
          'En la Tierra, cuando encendés una vela, la llama tiene esa forma alargada y puntiaguda que todos conocemos debido a que el aire caliente, al ser menos denso, sube, y el aire frío baja para ocupar su lugar (convección natural). Si un astronauta encendiera una vela dentro de la Estación Espacial Internacional (en microgravedad y con atmósfera de oxígeno), ¿qué forma tendría la llama y por qué?', null, '["La llama sería mucho más larga y delgada, buscando alcanzar el techo del módulo.","La llama sería esférica, debido a que la difusión de gases es uniforme en todas las direcciones.","La vela no podría encenderse, ya que el fuego requiere gravedad para existir.","La llama sería errática y cambiaría de forma constantemente por las corrientes de aire del ventilador.","La llama sería plana y se expandiría hacia los costados sobre la base de la vela."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q4
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 4, 'Energía y Tecnología',
          'En una resistencia eléctrica de 4 bandas, la cuarta banda (usualmente dorada o plateada) indica:', null, '["El valor principal en Ohmios.","El coeficiente de temperatura.","La tolerancia.","La potencia máxima.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q5
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 5, 'Energía y Tecnología',
          '¿Qué proceso ocurre dentro del reactor de una central nuclear como Atucha II?', null, '["Combustión química.","Fisión nuclear.","Fusión nuclear.","Ionización gaseosa.","Sublimación."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q6
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 6, 'Física: Mecánica',
          'Indique cuál de las siguientes afirmaciones es incorrecta:', null, '["El peso de un cuerpo es la fuerza gravitatoria ejercida por la Tierra sobre él.","La fuerza normal aparece como consecuencia de la interacción entre superficies en contacto.","El peso de un cuerpo y la fuerza normal que actúa sobre él forman un par de acción y reacción.","Los pares de acción y reacción actúan sobre cuerpos distintos.","Si un cuerpo está apoyado sobre una mesa horizontal y en equilibrio, la fuerza normal puede tener igual módulo que el peso."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q7
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 7, 'Física: Térmica',
          'Sacás una botella de gaseosa de la heladera y la dejás un rato sobre la mesa… a los pocos minutos ves un “charco” de agua debajo de la botella. ¿De dónde salió ese líquido?', null, '["De una fuga en la botella.","De la heladera, donde la botella “absorbió” agua de otros alimentos.","Del aire ambiente.","De la mesa.","Ninguna de las anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q8
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 8, 'Física: Mecánica',
          'Indique cuál de las siguientes afirmaciones es incorrecta.', null, '["Las fuerzas internas de un sistema forman pares de acción y reacción, por lo que su resultante total es nula.","Las fuerzas internas forman pares de acción y reacción; por ello, el trabajo total realizado por dichas fuerzas sobre el sistema es siempre nulo.","El trabajo realizado por una fuerza conservativa sobre una trayectoria cerrada es cero.","El roce cinético transforma energía mecánica en otras formas de energía.","Los pares de acción y reacción nunca pueden actuar sobre un mismo cuerpo."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q9
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 9, 'Física: Fluidos',
          'En un tubo con forma de U (con sus extremos abiertos al aire) se encuentran dos líquidos inmiscibles entre sí en equilibrio hidrostático. En la rama izquierda se observa que la altura del líquido Azul, de densidad ρ<sub>A</sub>, es h<sub>A</sub>. En el resto del tubo se encuentra el líquido Rojo de densidad ρ<sub>R</sub>. La diferencia de altura entre sus superficies libres es Δh. Conociendo que ρ<sub>A</sub> es el 75% de ρ<sub>R</sub>, entonces Δh es:', 'figs/q9.jpg', '["125 % de h<sub>A</sub>.","Igual a h<sub>A</sub>.","75 % de h<sub>A</sub>.","25 % de h<sub>A</sub>.","Ninguna de las respuestas anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q10
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 10, 'Energía y Tecnología',
          'Respecto de la licuación del gas natural, indique la afirmación incorrecta:', null, '["Requiere temperaturas muy bajas.","Facilita almacenamiento y transporte.","Es obligatoria para transportarlo por gasoductos.","Se utiliza para transporte en buques metaneros.","Reduce considerablemente el volumen ocupado."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q11
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 11, 'Física: Fluidos',
          'Un bloque de aluminio de 8,1 kg se encuentra totalmente sumergido en agua y sostenido mediante una cuerda (ver figura). ¿Cuál es la tensión en la cuerda? Datos: ρ<sub>agua</sub> = 1000 kg/m³ ; ρ<sub>aluminio</sub> = 2700 kg/m³.', 'figs/q11.jpg', '["30 N","51 N","81 N","111 N","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q12
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 12, 'Química',
          'Los isótopos de un mismo elemento químico poseen:', null, '["Igual número atómico y distinto número de neutrones.","Distinto número atómico e igual número másico.","Distinta cantidad de protones.","Distinta cantidad de electrones.","Igual número másico y distinto número atómico."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'A' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q13
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 13, 'Química',
          '¿Qué compuestos liberados a la atmósfera son los principales causantes de la lluvia ácida?', null, '["Oxígeno y nitrógeno.","Vapor de agua.","Metano y dióxido de carbono.","Óxidos de azufre y nitrógeno.","Helio y argón."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q14
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 14, 'Física: Electricidad',
          'En el siguiente circuito (ideal) de corriente continua todas las lámparas son iguales entre sí y están en perfecto estado. Para este circuito en particular:', 'figs/q14.jpg', '["La corriente que circula por la lámpara 4 es el doble de la que circula por la lámpara 7.","La corriente que circula por la lámpara 5 es la mitad de la que circula por la lámpara 7.","Ninguna de las lámparas está encendida.","La intensidad luminosa en la lámpara 4 es igual a la de la lámpara 6.","Ninguna de las anteriores respuestas es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q15
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 15, 'Física: Térmica',
          'Se dispone de 1 kg de agua a 100 ºC y cierta masa de hielo a 0 ºC dentro de un calorímetro ideal (C<sub>agua</sub> = 4.186 J/kg·ºC ; L<sub>fusión</sub> = 334.000 J/kg). El sistema evoluciona térmicamente hasta una temperatura final de equilibrio de 20 ºC. Entonces la masa inicial de hielo era:', null, '["0,56 kg.","0,80 kg.","0,96 kg.","1,24 kg.","1,28 kg."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q16
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 16, 'Química',
          'La función principal de un catalizador en una reacción química es:', null, '["Aportar energía térmica adicional al sistema.","Consumirse durante la reacción.","Aumentar la energía de activación.","Ofrecer un camino alternativo con una barrera energética menor.","Hacer que una reacción imposible ocurra espontáneamente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q17
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 17, 'Biología',
          'En una célula vegetal, hay un “tanque de agua y reserva” tan inmenso que puede llegar a ocupar hasta el 90% de todo el espacio interno, empujando al núcleo y a las demás organelas contra los bordes. ¿Qué estructura es la encargada de este almacenamiento masivo que domina el interior vegetal?', null, '["Núcleo.","Vacuola.","Lisosoma.","Mitocondria.","Ribosoma."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q18
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 18, 'Física: Fluidos',
          'Con referencia al principio de Bernoulli para fluidos ideales, indique cuál de las siguientes afirmaciones es incorrecta:', null, '["No interviene en su expresión matemática la viscosidad del fluido.","El término ½·ρ·v² tiene unidades de Joule.","El término ρ·g·h tiene en cuenta la energía potencial gravitatoria del fluido por unidad de volumen.","Las condiciones para aplicar el principio requieren que el fluido sea no viscoso, estacionario e incompresible.","Se puede aplicar también a gases, mientras estos verifiquen las condiciones exigidas para utilizar Bernoulli."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q19
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 19, 'Energía y Tecnología',
          'La energía mareomotriz aprovecha:', null, '["El oleaje superficial.","Las corrientes oceánicas profundas.","Las mareas.","El calor del océano.","La evaporación del agua."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q20
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 20, 'Órdenes de magnitud',
          'Si un átomo tuviera el tamaño del estadio de River Plate, su núcleo sería aproximadamente del tamaño de:', null, '["Una pelota de fútbol.","Un automóvil.","Un garbanzo o canica.","Un grano microscópico invisible.","Una célula."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q21
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 21, 'Física: Térmica',
          'Se coloca dentro de un calorímetro ideal un kilogramo de cierta sustancia líquida a temperatura T<sub>A</sub> y otro kilogramo de la misma sustancia (también líquida) a T<sub>B</sub>. Considerando que T<sub>A</sub> es mayor que T<sub>B</sub>, entonces:', null, '["La temperatura T<sub>A</sub> disminuirá hasta alcanzar la temperatura T<sub>B</sub>.","La temperatura T<sub>B</sub> aumentará hasta alcanzar la temperatura T<sub>A</sub>.","La temperatura final de equilibrio dependerá del valor del calor específico de la sustancia.","La temperatura final de equilibrio será el promedio entre T<sub>A</sub> y T<sub>B</sub>.","Ninguna de las respuestas anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q22
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 22, 'Química',
          'El aire atmosférico se clasifica principalmente como:', null, '["Sustancia pura.","Mezcla homogénea.","Mezcla heterogénea.","Compuesto químico.","Gas noble."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q23
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 23, 'Energía y Tecnología',
          '¿Cuál de las siguientes centrales se encuentra en la provincia de Buenos Aires?', null, '["Yacyretá.","Atucha II.","Embalse.","Costanera.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q24
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 24, 'Física: Térmica',
          'Durante un cambio de fase de una sustancia pura a presión constante, desde un estado sólido a un estado líquido, su temperatura:', null, '["Aumenta.","Disminuye.","Permanece constante.","Depende de la masa.","Aumenta linealmente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q25
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 25, 'Química',
          'Cuando un átomo neutro pierde electrones:', null, '["Se convierte en anión.","Se convierte en catión.","Se transforma en neutrón.","Aumenta su número atómico.","Se vuelve inestable nuclearmente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q26
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 26, 'Química',
          'Los gases nobles presentan muy baja reactividad porque:', null, '["No poseen electrones.","Tienen la capa externa completa.","Son radiactivos.","Solo existen artificialmente.","Son metales."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q27
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 27, 'Física: Fluidos',
          'Se ha diseñado un experimento para medir la densidad de un cubo homogéneo de madera. Se lo introduce en un recipiente que contiene aceite en su parte superior y agua en la inferior. El cubo queda en equilibrio hidrostático tal como se indica en la figura. Entonces, la densidad del cubo será:', 'figs/q27.jpg', '["Igual a la suma de la densidad del aceite más la del agua.","Igual al promedio de la densidad del aceite más la del agua.","Igual a un tercio de la suma de la densidad del aceite más la del agua.","No puede determinarse con los datos del enunciado.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q28
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 28, 'Física: Electricidad',
          'Tres resistencias de 30 Ω se encuentran conectadas como muestra el siguiente esquema. La resistencia equivalente es:', 'figs/q28.jpg', '["10 Ω","15 Ω","45 Ω","60 Ω","90 Ω"]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'A' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q29
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 29, 'Física: Térmica',
          'Cuando un aromatizante sólido desaparece sin pasar por estado líquido ocurre:', null, '["Evaporación.","Condensación.","Fusión.","Sublimación.","Solidificación."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q30
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 30, 'Física: Cinemática',
          'Teniendo en cuenta los siguientes gráficos, indique cuál de las siguientes respuestas es la incorrecta:', 'figs/q30.jpg', '["En las figuras 1 y 2 se representa la evolución temporal de las componentes x e y de la velocidad en un tiro oblicuo.","En las figuras 3 y 4 se representa la evolución temporal de las componentes x e y de la velocidad en un tiro oblicuo.","En la figura 5 se representa un MRU, donde el móvil partió desde la izquierda del origen de coordenadas.","En la figura 6 se representa un MRUV, donde el móvil se mueve en sentido negativo del eje “x”.","En la figura 7 se representa una gráfica posición-tiempo parabólica correspondiente a un movimiento de caída libre."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q31
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 31, 'Biología',
          'Tomamos dos células: una de la madera de un tronco y otra de un músculo humano. Las colocamos en un ambiente donde ambas absorben una gran cantidad de agua. La célula humana se hincha como un globo y corre riesgo de estallar. La célula del árbol se mantiene firme y conserva su forma. ¿Qué estructura posee la célula del árbol que evita que se deforme o estalle?', null, '["Membrana plasmática.","Citoesqueleto.","Pared celular.","Núcleo celular.","Ninguna de las anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q32
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 32, 'Energía y Tecnología',
          '¿Qué material es más adecuado para cables de alta tensión?', null, '["Cerámica.","Polímero.","Argón.","Hierro.","Cobre."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'E' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q33
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 33, 'Física: Mecánica',
          'Una partícula se mueve en una montaña rusa ideal sin rozamiento. ¿Cuál afirmación es incorrecta?', null, '["En el punto más bajo de la montaña rusa la energía cinética es máxima.","La energía mecánica permanece constante.","La velocidad máxima ocurre en el punto más alto.","La energía potencial depende de la altura.","La energía mecánica es igual en todos los puntos."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q34
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 34, 'Química',
          '¿Cuál de los siguientes fenómenos corresponde a una transformación química?', null, '["Evaporación del agua.","Doblar una chapa.","Oxidación del hierro.","Romper una tiza.","Fundir cera."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q35
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 35, 'Física: Mecánica',
          'Colocamos un dron dentro de una caja de acrílico herméticamente cerrada y la apoyamos sobre una balanza de alta precisión. Con el dron apagado en el fondo, la balanza marca exactamente 1000 g. Si encendemos el dron y logramos que se mantenga en vuelo estacionario (quieto en el aire) sin tocar ninguna pared, ¿qué marcará la balanza?', null, '["La balanza marca menos de 1000 g.","La balanza marca exactamente lo mismo.","La balanza marca más de 1000 g.","La balanza marca cero.","La medición fluctúa indefinidamente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q36
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 36, 'Física: Térmica',
          '¿Cuál de las siguientes afirmaciones sobre transferencia de calor es incorrecta?', null, '["En fluidos predomina la convección.","El calor fluye del cuerpo con mayor calor hacia el de menor calor.","El calor latente se mide en J/kg.","Entre la Tierra y el espacio no hay conducción.","El calor de una fogata se siente principalmente por radiación."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q37
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 37, 'Energía y Tecnología',
          '¿Cuál de las siguientes es una propiedad mecánica?', null, '["Conductividad eléctrica.","Punto de fusión.","Resistencia a la corrosión.","Dureza.","Índice de refracción."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q38
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 38, 'Física: Cinemática',
          'Se deja caer una piedra desde cierta altura y simultáneamente otra se lanza verticalmente hacia arriba desde el suelo. ¿Cuál afirmación es correcta?', null, '["Al cruzarse tienen igual velocidad.","Se cruzan cuando la segunda alcanza su altura máxima.","En la altura máxima la aceleración es nula.","La piedra arrojada desde el piso tarda el mismo tiempo en llegar a su altura máxima de lo que tarda la que se dejó caer en llegar al piso.","Ninguna de las anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'E' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q39
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 39, 'Lógica y estimación',
          'La potencia de un tractor depende de la rapidez según: P = c·v<sup>3,2</sup>. Si la potencia se triplica, la nueva rapidez máxima resultará aproximadamente:', null, '["0,29 veces la original.","1,41 veces la original.","2,41 veces la original.","3 veces la original.","3,2 veces la original."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q40
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ('00000000-0000-0000-0000-000000000026', 40, 'Física: Cinemática',
          'En un tiro vertical hacia arriba, al llegar a la altura máxima:', null, '["Velocidad y aceleración son nulas.","La aceleración desaparece.","La velocidad es nula y la aceleración no.","La energía cinética es máxima.","La gravedad deja de actuar."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

