import type { ImageMetadata } from 'astro';
import biscottoOnbody from '../assets/designs/biscotto/onbody.jpg';
import biscottoDetail from '../assets/designs/biscotto/detail.jpg';
import biscottoBack from '../assets/designs/biscotto/back.jpg';
import biscottoLifestyle from '../assets/designs/biscotto/lifestyle.jpg';

export type SketchKind = 'solid' | 'stripes' | 'dots' | 'check' | 'breton';

export interface Sketch {
  kind: SketchKind;
  base: string;
  ink: string;
  binding: string;
  mesh: string;
  cord: string;
}

export interface DesignImage {
  src: ImageMetadata;
  alt: string;
  // Every design shows the same 4 shots in the same order, so no design wins on photography:
  // on-body running front, open-front detail, back, lifestyle.
  shot: 'onbody' | 'detail' | 'back' | 'lifestyle';
}

export interface Design {
  id: string;
  no: string;
  slug: string;
  name: string;
  note: string;
  status: 'live' | 'sketch';
  swatch: string; // the design's main colour, used for its progress dot
  heart: string; // chameleon mode: the heart takes this colour while the design is on top
  tint: string; // page background while this design is on top (the "chameleon")
  panel: string; // background behind the vest image
  images?: DesignImage[];
  sketch?: Sketch;
}

export const designs: Design[] = [
  {
    id: 'd01',
    no: '01',
    slug: 'biscotto',
    name: 'biscotto',
    note: 'cream, chocolate dots, butter binding',
    status: 'live',
    swatch: '#EDD7BF',
    heart: '#4C2C1F',
    tint: '#F1E9DE',
    panel: '#E4D6C4',
    images: [
      { src: biscottoOnbody, alt: 'A runner in the park wearing the biscotto vest, pockets filled', shot: 'onbody' },
      { src: biscottoDetail, alt: 'The biscotto vest held open to show the bungee lacing inside', shot: 'detail' },
      { src: biscottoBack, alt: 'The back of the biscotto vest with the zipped pocket open', shot: 'back' },
      { src: biscottoLifestyle, alt: 'The biscotto vest worn at a café table', shot: 'lifestyle' },
    ],
  },
  {
    id: 'd02',
    no: '02',
    slug: 'pistacchio',
    name: 'pistacchio',
    note: 'sage green, cream binding',
    status: 'sketch',
    swatch: '#A9B98A',
    heart: '#5E6B3A',
    tint: '#E4EAD8',
    panel: '#CBD5B5',
    sketch: { kind: 'solid', base: '#A9B98A', ink: '#8C9A70', binding: '#F4EFE2', mesh: '#8C9A70', cord: '#F4EFE2' },
  },
  {
    id: 'd03',
    no: '03',
    slug: 'fragola',
    name: 'fragola',
    note: 'pink and white stripes, strawberry binding',
    status: 'sketch',
    swatch: '#F3B7C2',
    heart: '#B0355A',
    tint: '#F8E5E9',
    panel: '#F2CDD5',
    sketch: { kind: 'stripes', base: '#F3B7C2', ink: '#FFF6F3', binding: '#D9425B', mesh: '#E7A2AF', cord: '#D9425B' },
  },
  {
    id: 'd04',
    no: '04',
    slug: 'liquirizia',
    name: 'liquirizia',
    note: 'black, reflective dots, lime binding',
    status: 'sketch',
    swatch: '#232120',
    heart: '#232120',
    tint: '#E0DEDA',
    panel: '#2E2C2B',
    sketch: { kind: 'dots', base: '#232120', ink: '#CFCFCA', binding: '#D7F05A', mesh: '#3A3735', cord: '#D7F05A' },
  },
  {
    id: 'd05',
    no: '05',
    slug: 'limone',
    name: 'limone',
    note: 'lemon gingham, cobalt binding',
    status: 'sketch',
    swatch: '#F6D55C',
    heart: '#2E5BBA',
    tint: '#FBF1CF',
    panel: '#F4E09A',
    sketch: { kind: 'check', base: '#F6D55C', ink: '#FFFFFF', binding: '#2E5BBA', mesh: '#E7C24A', cord: '#2E5BBA' },
  },
  {
    id: 'd06',
    no: '06',
    slug: 'mirtillo',
    name: 'mirtillo',
    note: 'navy Breton stripes, coral cord',
    status: 'sketch',
    swatch: '#26315F',
    heart: '#26315F',
    tint: '#E3E6EF',
    panel: '#C9CEDF',
    sketch: { kind: 'breton', base: '#F2EEE6', ink: '#26315F', binding: '#26315F', mesh: '#D9D3C7', cord: '#E0623F' },
  },
];
