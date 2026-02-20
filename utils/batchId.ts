export function generateBatchId(speciesName: string, when = new Date()) {
    const pad = (n: number) => String(n).padStart(2, "0");
  
    const y = when.getFullYear();
    const m = pad(when.getMonth() + 1);
    const d = pad(when.getDate());
  
    const datePart = `${y}${m}${d}`;
  
    const speciesPart = speciesName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ") // cleanup
      .trim()
      .replace(/\s+/g, ""); // collapse spaces
  
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  
    return `${datePart}-${speciesPart || "FISH"}-${rand}`;
  }
  