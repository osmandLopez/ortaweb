-- La categoría "Apartados" venía del catálogo de muestra y ya no tiene sentido:
-- con el sistema de apartados fuera, aparecería vacía en el submenú de Tienda.
--
-- Se borra solo si de verdad quedó huérfana. Las dos condiciones son la
-- salvaguarda: si alguien colgó productos o subcategorías de ella, la fila se
-- queda como está y no se rompe ninguna referencia. Ningún pedido, producto ni
-- usuario se toca aquí.
DELETE FROM `categorias`
WHERE `slug` = 'apartados'
  AND `id` NOT IN (SELECT `categoria_id` FROM `productos`)
  AND `id` NOT IN (SELECT `padre_id` FROM `categorias` WHERE `padre_id` IS NOT NULL);
