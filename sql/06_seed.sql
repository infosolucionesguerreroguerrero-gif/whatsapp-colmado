/* =====================================================================
   WHATSAPP COLMADO - Archivo 06: Datos iniciales (seed)
   ===================================================================== */
USE ColmadoDB;
GO

/* ---- Estados ---- */
MERGE dbo.EstadosPedidos AS t
USING (VALUES
    (1, N'Recibido',   1),
    (2, N'Confirmado', 2),
    (3, N'Preparando', 3),
    (4, N'Enviado',    4),
    (5, N'Entregado',  5),
    (6, N'Cancelado',  6)
) AS s (EstadoId, Nombre, Orden)
ON t.EstadoId = s.EstadoId
WHEN NOT MATCHED THEN INSERT (EstadoId, Nombre, Orden) VALUES (s.EstadoId, s.Nombre, s.Orden);
GO

/* ---- Configuración ---- */
MERGE dbo.Configuracion AS t
USING (VALUES
    ('business_name',        N'COLMADO LA ESPERANZA'),
    ('business_phone',       N'809-000-0000'),
    ('business_address',     N'Calle Principal #1, Santo Domingo'),
    ('currency',             N'RD$'),
    ('itbis_rate',           N'0.0'),
    ('default_delivery_fee', N'100')
) AS s (Clave, Valor)
ON t.Clave = s.Clave
WHEN NOT MATCHED THEN INSERT (Clave, Valor) VALUES (s.Clave, s.Valor);
GO

/* ---- Formas de Pago ---- */
MERGE dbo.FormasPago AS t
USING (VALUES
    ('1', N'Efectivo',          1, 0, 0),
    ('2', N'Transferencia',     2, 1, 0),
    ('3', N'Tarjeta',           3, 1, 0),
    ('4', N'Contra entrega',    4, 0, 0),
    ('5', N'Cheque',            5, 1, 0),
    ('6', N'Pago múltiple',     6, 0, 1),
    ('C', N'Crédito',           7, 0, 0),
    ('8', N'Nota de crédito',  8, 0, 0)
) AS s (Codigo, Nombre, Orden, RequiereReferencia, EsPagoMultiple)
ON t.Codigo = s.Codigo
WHEN NOT MATCHED THEN INSERT (Codigo, Nombre, Orden, RequiereReferencia, EsPagoMultiple)
VALUES (s.Codigo, s.Nombre, s.Orden, s.RequiereReferencia, s.EsPagoMultiple);
GO

/* ---- Monedas ---- */
MERGE dbo.Monedas AS t
USING (VALUES
    ('USD', N'Dólar estadounidense', 'US$', 0, 0, 1),
    ('EUR', N'Euro',                  '€',   0, 0, 2),
    ('CAD', N'Dólar canadiense',       'C$',  0, 0, 3)
) AS s (Codigo, Nombre, Simbolo, Tasa, Prima, Orden)
ON t.Codigo = s.Codigo
WHEN NOT MATCHED THEN INSERT (Codigo, Nombre, Simbolo, Tasa, Prima, Orden)
VALUES (s.Codigo, s.Nombre, s.Simbolo, s.Tasa, s.Prima, s.Orden);
GO

/* ---- Categorías ---- */
MERGE dbo.Categorias AS t
USING (VALUES
    (N'Bebidas',1),(N'Lácteos',2),(N'Carnes',3),(N'Embutidos',4),
    (N'Vegetales',5),(N'Enlatados',6),(N'Panadería',7),(N'Snacks',8),
    (N'Limpieza',9),(N'Higiene',10),(N'Congelados',11),(N'Víveres',12)
) AS s (Nombre, Orden)
ON t.Nombre = s.Nombre
WHEN NOT MATCHED THEN INSERT (Nombre, Orden) VALUES (s.Nombre, s.Orden);
GO

/* ---- Productos (con upsert por Nombre) ---- */
;WITH cat AS (SELECT CategoriaId, Nombre FROM dbo.Categorias)
MERGE dbo.Productos AS t
USING (
    SELECT * FROM (VALUES
        (N'Coca Cola 2L',       N'Coca Cola', N'2L',     N'litro',  N'Bebidas',   120.00, N'coca,refresco,gaseosa,cola'),
        (N'Coca Cola 1L',       N'Coca Cola', N'1L',     N'litro',  N'Bebidas',    75.00, N'coca,refresco,gaseosa'),
        (N'Agua 1 galón',       N'Planeta',   N'1gal',   N'galón',  N'Bebidas',    55.00, N'agua,botellon'),
        (N'Jugo de naranja 1L', N'Rica',      N'1L',     N'litro',  N'Bebidas',    90.00, N'jugo,naranja'),
        (N'Leche entera 1L',    N'Rica',      N'1L',     N'litro',  N'Lácteos',    85.00, N'leche'),
        (N'Queso geo 1 lb',     N'Geo',       N'1 lb',   N'libra',  N'Lácteos',   180.00, N'queso'),
        (N'Huevos docena',      N'Granja',    N'docena', N'docena', N'Lácteos',   140.00, N'huevo,huevos'),
        (N'Arroz 10 lb',        N'Cibao',     N'10 lb',  N'libra',  N'Víveres',   550.00, N'arroz'),
        (N'Arroz 5 lb',         N'Cibao',     N'5 lb',   N'libra',  N'Víveres',   290.00, N'arroz'),
        (N'Aceite 1L',          N'Crisol',    N'1L',     N'litro',  N'Víveres',   210.00, N'aceite'),
        (N'Habichuela roja 1lb',N'Cibao',     N'1 lb',   N'libra',  N'Víveres',    75.00, N'habichuela,frijol'),
        (N'Espagueti 1 lb',     N'Milano',    N'1 lb',   N'libra',  N'Víveres',    55.00, N'espagueti,pasta,fideo'),
        (N'Pan de agua',        N'Local',     N'unidad', N'unidad', N'Panadería',  30.00, N'pan,panes'),
        (N'Salami 1 lb',        N'Induveca',  N'1 lb',   N'libra',  N'Embutidos', 160.00, N'salami'),
        (N'Pollo entero',       N'Cibao',     N'unidad', N'unidad', N'Carnes',    320.00, N'pollo'),
        (N'Papas 1 lb',         N'Local',     N'1 lb',   N'libra',  N'Vegetales',  45.00, N'papa,papas'),
        (N'Atún lata',          N'Calvo',     N'lata',   N'unidad', N'Enlatados',  95.00, N'atun'),
        (N'Galletas',           N'Hatuey',    N'paquete',N'unidad', N'Snacks',     40.00, N'galleta,galletas'),
        (N'Jabón de cuaba',     N'Candado',   N'unidad', N'unidad', N'Limpieza',   35.00, N'jabon'),
        (N'Papel higiénico 4u', N'Nevax',     N'4u',     N'unidad', N'Higiene',   120.00, N'papel,higienico')
    ) AS p (Nombre, Marca, Presentacion, Unidad, Categoria, Precio, Palabras)
) AS s
ON t.Nombre = s.Nombre
WHEN NOT MATCHED THEN
    INSERT (CategoriaId, Nombre, Marca, Presentacion, Unidad, Precio, Palabras)
    VALUES ((SELECT CategoriaId FROM cat WHERE cat.Nombre = s.Categoria),
            s.Nombre, s.Marca, s.Presentacion, s.Unidad, s.Precio, s.Palabras);
GO

/* ---- Inventario inicial (50 unidades a todo lo que esté en 0) ---- */
UPDATE inv SET Existencia = 50, StockMinimo = 5
FROM dbo.Inventario inv
WHERE inv.Existencia = 0;
GO

/* ---- Impresora por defecto ---- */
IF NOT EXISTS (SELECT 1 FROM dbo.Impresoras)
INSERT INTO dbo.Impresoras (Nombre, Driver, Host, Puerto, Ancho)
VALUES (N'Caja principal', 'network', '192.168.1.50', 9100, 42);
GO

/* ---- Oferta de ejemplo ---- */
IF NOT EXISTS (SELECT 1 FROM dbo.Ofertas)
INSERT INTO dbo.Ofertas (ProductoId, Descripcion, PrecioOferta, FechaInicio, FechaFin)
SELECT TOP 1 ProductoId, N'Coca Cola 2L en oferta', 99.00,
       CAST(SYSUTCDATETIME() AS DATE), DATEADD(DAY, 30, CAST(SYSUTCDATETIME() AS DATE))
FROM dbo.Productos WHERE Nombre = N'Coca Cola 2L';
GO

PRINT 'Datos iniciales cargados correctamente.';
GO
