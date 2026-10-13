export const invalidPasswords = [
  ['empty', ''],
  ['less than eight', 'Ab1!xyz'],
  ['missing uppercase', 'abcdef1!'],
  ['missing lowercase', 'ABCDEF1!'],
  ['missing number', 'Abcdefg!'],
  ['missing symbol', 'Abcdef12'],
  ['space is not a symbol', 'Abcdef1 '],
  ['Unicode letter is not a symbol', 'Abcdef1é'],
  ['Unicode number is not a symbol', 'Abcdef1٢'],
  ['over maximum', 'Ab1!' + 'x'.repeat(125)],
  ['null', null],
  ['number', 12345678],
];
export const minimumPassword = 'Abcdef1!';
