

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function convertBelowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n] + " ";
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "") + " ";
  return ONES[Math.floor(n / 100)] + " Hundred " + convertBelowThousand(n % 100);
}

export function numberToWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "Zero Rupees Only";

  const num = Math.floor(Math.abs(amount));
  const paisa = Math.round((Math.abs(amount) - num) * 100);

  let result = "";

  const crore = Math.floor(num / 10000000);
  const remainderCrore = num % 10000000;

  const lakh = Math.floor(remainderCrore / 100000);
  const remainderLakh = remainderCrore % 100000;

  const thousand = Math.floor(remainderLakh / 1000);
  const remainderThousand = remainderLakh % 1000;

  if (crore > 0) {
    result += convertBelowThousand(crore).trim() + " Crore ";
  }
  if (lakh > 0) {
    result += convertBelowThousand(lakh).trim() + " Lakh ";
  }
  if (thousand > 0) {
    result += convertBelowThousand(thousand).trim() + " Thousand ";
  }
  if (remainderThousand > 0) {
    result += convertBelowThousand(remainderThousand).trim() + " ";
  }

  result = result.trim() + " Rupees";

  if (paisa > 0) {
    result += " and " + convertBelowThousand(paisa).trim() + " Paisa";
  }

  return result + " Only";
}
