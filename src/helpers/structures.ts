
// Sorted lists
export function binSearch<T, K>(arr: T[], el: K, key: (el: T) => K) {
  let a = 0
  let b = arr.length - 1

  while (a <= b) { // = too cause it needs check for last element!
    const idxMid = Math.trunc((a + b) / 2) // Alternative do (((a + b) / 2) | 0)
    const elMid = key(arr[idxMid])
    if (elMid > el) {
      b = idxMid - 1
    } else if (elMid < el) {
      a = idxMid + 1
    } else {
      return idxMid
    }
  }
  return a // Is this correct??? (yes return the first LARGER so insert is good)
}

export function sortedInsert<T, K>(arr: T[], el: T, key: (el: T) => K) {
  const pos = binSearch(arr, key(el), key)
  arr.splice(pos, 0, el)
  return pos
}

export class SortedArr<T, K> {
  constructor(public arr: T[], private key: (el: T) => K) { }
  insert(el: T) {
    return sortedInsert(this.arr, el, this.key)
  }
  search(el: K) {
    return binSearch(this.arr, el, this.key)
  }
}
