export function getTimeBackground() {
  const h = new Date().getHours() + new Date().getMinutes() / 60
  const t = h < 6 ? h + 24 : h
  if (t >= 20 || t < 6) return '#241F44'
  if (t >= 18) return '#FCCC83'
  if (t >= 12) return '#FFFAF2'
  return '#F6F3EE'
}

export function isNightTime() {
  const h = new Date().getHours()
  return h >= 20 || h < 6
}
