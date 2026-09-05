/** Sin filtro nativo en AngularJS (ver CONCEPTOS "Pipes") — mayúscula la primera letra de cada palabra. */
export function titleCaseFilter(): (value: string | null | undefined) => string {
  return (value) => {
    if (value == null) return "";
    return String(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  };
}
