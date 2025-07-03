import fetch from "node-fetch";

export async function getLatLngFromPostcode(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    const data = await res.json();
    if (data.status === 200 && data.result) {
      return {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch lat/lng for postcode:", postcode, error);
    return null;
  }
}
