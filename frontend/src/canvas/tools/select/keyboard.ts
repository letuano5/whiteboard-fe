import { handleSelectKey } from '../../shortcuts/select-shortcuts';

export function onSelectKeyDown(key: string, ctrlOrMeta = false): void {
  handleSelectKey(key, ctrlOrMeta);
}
