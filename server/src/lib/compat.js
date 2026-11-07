// Standard red-cell compatibility matrix:
// donor kis group ko khoon de sakta hai.
const MATRIX = {
  'O-': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
}

export function canDonateTo(donorGroup, requestedGroup) {
  const list = MATRIX[donorGroup]
  if (!list) return false
  return list.includes(requestedGroup)
}

export default canDonateTo
