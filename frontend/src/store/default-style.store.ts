import { create } from 'zustand';
import type { ElementProps } from '../types/shared';

export type DefaultStyle = Pick<
  ElementProps,
  | 'strokeColor'
  | 'fillColor'
  | 'strokeWidth'
  | 'strokeStyle'
  | 'opacity'
  | 'fontSize'
  | 'fontFamily'
  | 'textAlign'
>;

export const DEFAULT_STYLE_INITIAL: DefaultStyle = {
  strokeColor: '#1a1a1a',
  fillColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
  fontSize: 16,
  fontFamily: 'sans-serif',
  textAlign: 'left',
};

interface DefaultStyleActions {
  setDefaultStyle: (partial: Partial<DefaultStyle>) => void;
}

export const useDefaultStyleStore = create<DefaultStyle & DefaultStyleActions>()((set) => ({
  ...DEFAULT_STYLE_INITIAL,
  setDefaultStyle: (partial) => set(partial),
}));
