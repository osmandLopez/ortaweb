import type { Categoria, Producto, Sucursal } from '@/lib/types';

export const categorias: Categoria[] = [
  { id: 'c-temporada', slug: 'ventas-de-temporada', nombre: 'Ventas de temporada', padreId: null, acento: 'oro', orden: 1, activa: true },
  { id: 'c-novedades', slug: 'novedades', nombre: 'Novedades', padreId: null, acento: 'cielo', orden: 3, activa: true },
  { id: 'c-regalo', slug: 'regalo', nombre: 'Regalo', padreId: null, acento: 'tinta', orden: 4, activa: true },
  { id: 'c-papeleria', slug: 'papeleria', nombre: 'Papelería', padreId: null, acento: 'tinta', orden: 5, activa: true },
  { id: 'c-hogar', slug: 'hogar', nombre: 'Hogar', padreId: null, acento: 'tinta', orden: 6, activa: true },
  // Subcategorías
  { id: 'c-navidad', slug: 'navidad', nombre: 'Navidad', padreId: 'c-temporada', acento: 'oro', orden: 1, activa: true },
  { id: 'c-regreso', slug: 'regreso-a-clases', nombre: 'Regreso a clases', padreId: 'c-temporada', acento: 'oro', orden: 2, activa: true },
  { id: 'c-peluches', slug: 'peluches', nombre: 'Peluches', padreId: 'c-regalo', acento: 'tinta', orden: 1, activa: true },
  { id: 'c-velas', slug: 'velas-y-aromas', nombre: 'Velas y aromas', padreId: 'c-hogar', acento: 'tinta', orden: 1, activa: true },
];

export const sucursales: Sucursal[] = [
  {
    id: 's-centro',
    nombre: 'Orta Lomas Modelo',
    direccion: 'Av. Zempoala 7908, Col. Lomas Modelo, Monterrey',
    horario: 'Lun a vie 10:00–18:00 · Sáb 10:00–14:00 · Dom cerrado',
    cp: '',
  },
  {
    id: 's-plaza',
    nombre: 'Orta Centro',
    direccion: 'Juan Ignacio Ramón, Plaza Tiktok local 16, Centro, Monterrey',
    horario: 'Lun a sáb 10:00–18:00 · Dom 10:00–15:00',
    cp: '',
  },
  {
    id: 's-escobedo',
    nombre: 'Orta Escobedo',
    direccion: 'Av. Agualeguas 211 local D, Col. Santa Martha, Cd. Gral. Escobedo',
    horario: 'Lun a vie 10:00–18:00 · Sáb 10:00–14:00 · Dom cerrado',
    cp: '66064',
  },
];

const hoy = new Date().toISOString();

export const productos: Producto[] = [
  {
    id: 'p-001', slug: 'juego-de-vajilla-flor-de-talavera', nombre: 'Juego de vajilla Flor de Talavera',
    descripcion: '16 piezas de cerámica esmaltada, pintadas a mano. Aptas para lavavajillas y microondas.',
    precio: 289900, precioAnterior: 349900, sku: 'ORT-VAJ-16', stock: 6, categoriaId: 'c-hogar',
    imagenes: [],
    temporada: true, destacado: true, activo: true, creadoEn: hoy,
  },
  {
    id: 'p-002', slug: 'oso-gigante-noa-120cm', nombre: 'Oso gigante Noa · 120 cm',
    descripcion: 'Peluche de felpa extrasuave con relleno hipoalergénico. El clásico de la vitrina.',
    precio: 149900, precioAnterior: null, sku: 'ORT-PEL-120', stock: 3, categoriaId: 'c-peluches',
    imagenes: [],
    temporada: false, destacado: true, activo: true, creadoEn: hoy,
  },
  {
    id: 'p-003', slug: 'set-velas-cardamomo', nombre: 'Set de velas Cardamomo y cedro',
    descripcion: 'Tres velas de cera de soya en frasco ámbar. 40 horas de aroma cada una.',
    precio: 46900, precioAnterior: 59900, sku: 'ORT-VEL-03', stock: 24, categoriaId: 'c-velas',
    imagenes: [],
    temporada: true, destacado: true, activo: true, creadoEn: hoy,
  },
  {
    id: 'p-004', slug: 'mochila-escolar-ruta', nombre: 'Mochila escolar Ruta',
    descripcion: 'Tela resistente al agua, compartimento acolchado para laptop de 14".',
    precio: 89900, precioAnterior: 109900, sku: 'ORT-MOC-14', stock: 18, categoriaId: 'c-regreso',
    imagenes: [],
    temporada: true, destacado: false, activo: true, creadoEn: hoy,
  },
  {
    id: 'p-005', slug: 'cuaderno-cosido-tinta', nombre: 'Cuaderno cosido Tinta · 120 hojas',
    descripcion: 'Papel de 90 g, costura vista y tapa dura entelada. Abre completamente plano.',
    precio: 21900, precioAnterior: null, sku: 'ORT-CUA-120', stock: 60, categoriaId: 'c-papeleria',
    imagenes: [],
    temporada: false, destacado: true, activo: true, creadoEn: hoy,
  },
  {
    id: 'p-006', slug: 'arbol-navideno-nevado-180', nombre: 'Árbol navideño nevado · 1.80 m',
    descripcion: 'Estructura metálica con 1,200 puntas y acabado nevado. Se guarda en su caja original.',
    precio: 259900, precioAnterior: 319900, sku: 'ORT-NAV-180', stock: 4, categoriaId: 'c-navidad',
    imagenes: [],
    temporada: true, destacado: true, activo: true, creadoEn: hoy,
  },
  {
    id: 'p-007', slug: 'lampara-de-buro-media-luna', nombre: 'Lámpara de buró Media Luna',
    descripcion: 'Base de cerámica mate y pantalla de lino. Incluye foco cálido regulable.',
    precio: 119900, precioAnterior: null, sku: 'ORT-LAM-ML', stock: 9, categoriaId: 'c-hogar',
    imagenes: [],
    temporada: false, destacado: false, activo: true, creadoEn: hoy,
  },
  {
    id: 'p-008', slug: 'caja-de-regalo-armable', nombre: 'Caja de regalo armable con moño',
    descripcion: 'Cartón rígido con listón de raso. Se arma sin pegamento en menos de un minuto.',
    precio: 12900, precioAnterior: null, sku: 'ORT-CAJ-01', stock: 0, categoriaId: 'c-regalo',
    imagenes: [],
    temporada: false, destacado: false, activo: true, creadoEn: hoy,
  },
];
