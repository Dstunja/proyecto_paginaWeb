/**
 * Texto de la misión y la visión, que se muestra en las pestañas de
 * /nosotros/ (ver src/components/MisionVision.astro).
 *
 * Es el texto OFICIAL de la empresa (confirmado por el dueño el 10/10/2026):
 * no se reescribe sin su aprobación. Si cambia, basta con editar `texto` y
 * `puntos` de cada panel; las pestañas se arman a partir de esta lista.
 *
 * `puntos` son las tres o cuatro ideas cortas que aparecen como píldoras
 * debajo del párrafo; conviene que salgan del mismo texto aprobado.
 */

export interface PanelMisionVision {
  /** Identificador para los ids de pestaña y panel. */
  id: string;
  /** Rótulo de la pestaña. */
  tab: string;
  titulo: string;
  /** Nombre de ícono válido en src/components/Icono.astro. */
  icono: string;
  texto: string;
  puntos: string[];
}

export const panelesMisionVision: PanelMisionVision[] = [
  {
    id: 'mision',
    tab: 'Misión',
    titulo: 'Nuestra misión',
    icono: 'target',
    texto:
      'Ser la principal empresa distribuidora de productos de consumo masivo ofreciendo a nuestros clientes la mejor variedad y calidad, mientras generamos oportunidades de crecimiento y desarrollo para todas las partes interesadas.',
    puntos: ['Variedad y calidad', 'Crecimiento compartido', 'Servicio al cliente'],
  },
  {
    id: 'vision',
    tab: 'Visión',
    titulo: 'Nuestra visión',
    icono: 'eye',
    texto:
      'Convertirnos en el referente de excelencia en distribución, siendo reconocidos por la eficiencia operativa, la satisfacción del cliente y el compromiso con el bienestar de nuestra comunidad.',
    puntos: ['Eficiencia operativa', 'Satisfacción del cliente', 'Compromiso con la comunidad'],
  },
];
