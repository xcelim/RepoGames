import Ionicons from '@expo/vector-icons/Ionicons';

import { SORT_OPTIONS } from '@/data/meta';
import type { ListSort } from '@/types';

import { Sheet, SheetRow, useIgnColors } from './ign';

// La hoja "ORDENAR" de IGN con todas sus opciones.
export function SortSheet({
  visible,
  value,
  onChange,
  onClose,
  manualLabel,
}: {
  visible: boolean;
  value: ListSort;
  onChange: (sort: ListSort) => void;
  onClose: () => void;
  manualLabel?: string;
}) {
  const c = useIgnColors();
  return (
    <Sheet visible={visible} title="Ordenar" onClose={onClose} doneLabel={null}>
      {SORT_OPTIONS.map((option, i) => (
        <SheetRow
          key={option.id}
          label={option.id === 'manual' && manualLabel ? manualLabel : option.label}
          selected={value === option.id}
          right={value === option.id ? <Ionicons name="checkmark" size={20} color={c.text} /> : null}
          onPress={() => {
            onChange(option.id);
            onClose();
          }}
          last={i === SORT_OPTIONS.length - 1}
        />
      ))}
    </Sheet>
  );
}
