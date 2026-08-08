import type { Binding } from '../../lib/shortcuts';

export type ToolKey =
  | 'select' | 'crop' | 'draw' | 'arrow' | 'line'
  | 'shape' | 'text' | 'mark' | 'blur' | 'step';

export interface Tool {
  key: ToolKey;
  label: string;
  icon: string;
  shortcut: string;
}

/** Ten tools, in this order, from scene I1. Order matters — it is muscle
 * memory, and reordering a toolbar silently costs every existing user. */
export const TOOLS: Tool[] = [
  { key: 'select', label: 'Select', icon: 'ant-design:drag-outlined', shortcut: 'V' },
  { key: 'crop', label: 'Crop', icon: 'ant-design:expand-outlined', shortcut: 'C' },
  { key: 'draw', label: 'Draw', icon: 'ant-design:edit-outlined', shortcut: 'D' },
  { key: 'arrow', label: 'Arrow', icon: 'ant-design:arrow-right-outlined', shortcut: 'A' },
  { key: 'line', label: 'Line', icon: 'ant-design:minus-outlined', shortcut: 'L' },
  { key: 'shape', label: 'Shape', icon: 'ant-design:border-outlined', shortcut: 'R' },
  { key: 'text', label: 'Text', icon: 'ant-design:font-size-outlined', shortcut: 'T' },
  { key: 'mark', label: 'Highlight', icon: 'ant-design:highlight-outlined', shortcut: 'H' },
  { key: 'blur', label: 'Blur or redact', icon: 'ant-design:eye-invisible-outlined', shortcut: 'B' },
  { key: 'step', label: 'Numbered step', icon: 'ant-design:number-outlined', shortcut: 'S' },
];

export const IMAGE_BINDINGS: Binding[] = [
  ...TOOLS.map(tool => ({
    key: tool.shortcut.toLowerCase(),
    label: tool.label,
    description: `Select the ${tool.label.toLowerCase()} tool`,
    scope: 'image' as const,
  })),
  { key: 'mod+z', label: 'Undo', description: 'Undo', scope: 'image' },
  { key: 'mod+shift+z', label: 'Redo', description: 'Redo', scope: 'image' },
  { key: 'escape', label: 'Deselect', description: 'Deselect or exit the current mode', scope: 'image' },
  { key: 'enter', label: 'Apply', description: 'Apply the current mode', scope: 'image' },
];


/** ToolKey is the design vocabulary; the Fabric hook has its own, older one.
 *
 * Seven of the ten map straight across. The other three — line, highlight and
 * numbered step — are specified by the prototype but not implemented in
 * useFabricEditor yet, so they have no Fabric name and the toolbar marks them
 * rather than rendering a button that quietly does nothing. */
export const FABRIC_TOOL: Partial<Record<ToolKey, string>> = {
  select: 'select',
  crop: 'crop',
  draw: 'pen',
  arrow: 'arrow',
  shape: 'rectangle',
  text: 'text',
  blur: 'blur',
};

/** Tools the design calls for that the canvas cannot do yet. */
export const UNIMPLEMENTED: ReadonlySet<ToolKey> = new Set<ToolKey>(['line', 'mark', 'step']);
