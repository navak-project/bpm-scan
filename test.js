
  // add x percentage to value
function per(num, amount) {
  return Math.round(num + (num * amount / 100));
}
function less(num, amount) {
  return Math.round(num - (num * amount / 100));
}
console.log(per(35, 10));
console.log(less(35, 10));

