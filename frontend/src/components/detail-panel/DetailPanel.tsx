import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { patchElement, updateElements } from '../../store/mutation-pipeline';
import type { ElementProps } from '../../types/shared';
import { PanelShell } from './PanelShell';
import { SectionTitle } from './SectionTitle';
import { StyleControls } from './StyleControls';
import { TextControls } from './TextControls';
import { TransformControls } from './TransformControls';
import {
  buildAnglePatchFromDegrees,
  buildMultiPropsPatches,
  buildPropsPatch,
  buildTextFontFamilyPatch,
  buildTextFontSizePatch,
} from './selection-patches';

export default function DetailPanel() {
  const selectedIds = useInteractionStore((state) => state.selectedIds);
  const elements = useElementsStore((state) => state.elements);

  if (selectedIds.length === 0) return null;

  if (selectedIds.length > 1) {
    const selectedElements = elements.filter(
      (element) => selectedIds.includes(element.id) && !element.isDeleted,
    );

    if (selectedElements.length === 0) return null;

    const firstProps = selectedElements[0].props;
    const hasFillableElement = selectedElements.some(
      (element) => element.type !== 'line' && element.type !== 'arrow',
    );

    function patchAll(partialProps: Partial<ElementProps>) {
      updateElements(buildMultiPropsPatches(selectedElements, partialProps));
    }

    return (
      <PanelShell>
        <SectionTitle>{selectedElements.length} shapes selected</SectionTitle>
        <StyleControls
          canFill={hasFillableElement}
          props={firstProps}
          titleSpacing
          onPatchProps={patchAll}
        />
      </PanelShell>
    );
  }

  const element = elements.find(
    (candidate) => candidate.id === selectedIds[0] && !candidate.isDeleted,
  );
  if (!element) return null;

  const selectedElement = element;
  const isText = selectedElement.type === 'text';

  function patchProps(partialProps: Partial<ElementProps>) {
    patchElement(selectedElement.id, buildPropsPatch(selectedElement, partialProps));
  }

  return (
    <PanelShell>
      <TransformControls
        angleDegrees={Math.round((selectedElement.angle * 180) / Math.PI)}
        onAngleChange={(degrees) =>
          patchElement(selectedElement.id, buildAnglePatchFromDegrees(degrees))
        }
      />

      <StyleControls
        canFill={selectedElement.type !== 'line'}
        isText={isText}
        props={selectedElement.props}
        titleSpacing
        onPatchProps={patchProps}
      />

      {isText && (
        <TextControls
          props={selectedElement.props}
          onFontSizeChange={(fontSize) =>
            patchElement(selectedElement.id, buildTextFontSizePatch(selectedElement, fontSize))
          }
          onFontFamilyChange={(fontFamily) =>
            patchElement(selectedElement.id, buildTextFontFamilyPatch(selectedElement, fontFamily))
          }
          onPatchProps={patchProps}
        />
      )}
    </PanelShell>
  );
}
