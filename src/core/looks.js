// カードの見た目（画面イメージの8色・6種の小物）。複製した順に回す
export const PALETTES = [
  { tint: '#fdeee8', shirt: '#f7a58f', shirtLight: '#ffd6c8', shirtDark: '#e6836a' },
  { tint: '#e6f3f9', shirt: '#8ecae6', shirtLight: '#d2ecf7', shirtDark: '#6bb0d2' },
  { tint: '#e7f6ed', shirt: '#9ad8b3', shirtLight: '#d6f2e1', shirtDark: '#72bf92' },
  { tint: '#f0ebfb', shirt: '#bba8ea', shirtLight: '#e4dbf9', shirtDark: '#9a84d6' },
  { tint: '#fff5dc', shirt: '#f6c86a', shirtLight: '#ffe9b8', shirtDark: '#e4ab46' },
  { tint: '#eaf0f7', shirt: '#a3b9d4', shirtLight: '#dbe5f1', shirtDark: '#7f9bbf' },
  { tint: '#fef0e3', shirt: '#f8b88b', shirtLight: '#ffe2cc', shirtDark: '#e99a63' },
  { tint: '#eef6e0', shirt: '#bedc86', shirtLight: '#e8f3cd', shirtDark: '#9ec45e' },
];

export const ACCESSORIES = ['headset', 'glasses', 'sprout', 'cap', 'bow', 'halo'];

export function defaultLook(index) {
  return { palette: index % PALETTES.length, acc: ACCESSORIES[index % ACCESSORIES.length] };
}
