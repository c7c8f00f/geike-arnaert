import { ok } from 'assert';

export function allOk(arrayLike) {
  for (let i = 0; i < arrayLike.length; ++i) {
    ok(arrayLike[i]);
  }
}
