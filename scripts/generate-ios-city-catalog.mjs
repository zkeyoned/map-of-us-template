import fs from "node:fs";

const citiesSource = fs.readFileSync("data/cities.ts", "utf8");
const provincesSource = fs.readFileSync("data/provinces.ts", "utf8");

function extractArray(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);

  const bracketStart = source.indexOf("[", start);
  let depth = 0;

  for (let index = bracketStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) return source.slice(bracketStart, index + 1);
  }

  throw new Error(`Unclosed ${marker}`);
}

const cityData = Function(`return (${extractArray(citiesSource, "const cityData")});`)();
const provinces = Function(`return (${extractArray(provincesSource, "export const provinces")});`)();
const provinceName = new Map(provinces.map((province) => [province.id, province.name]));
const featuredIds = new Set([
  "beihai",
  "beijing",
  "changchun",
  "changsha",
  "chengde",
  "chengdu",
  "chongqing",
  "dali",
  "dalian",
  "datong",
  "dongguan",
  "dujiangyan",
  "dunhuang",
  "foshan",
  "fuzhou",
  "guangzhou",
  "guilin",
  "guiyang",
  "haikou",
  "hangzhou",
  "harbin",
  "hefei",
  "hohhot",
  "hongkong",
  "huangshan",
  "jinan",
  "jingdezhen",
  "jinghong",
  "kaifeng",
  "kashgar",
  "kunming",
  "lanzhou",
  "leshan",
  "lhasa",
  "lijiang",
  "luoyang",
  "macau",
  "nanchang",
  "nanjing",
  "nanning",
  "ningbo",
  "qingdao",
  "quanzhou",
  "qufu",
  "sanya",
  "shanghai",
  "shantou",
  "shaoxing",
  "shenyang",
  "shenzhen",
  "suzhou",
  "taipei",
  "taiyuan",
  "tianjin",
  "urumqi",
  "wenzhou",
  "wuhan",
  "wuxi",
  "xiamen",
  "xian",
  "xining",
  "yanan",
  "yangzhou",
  "yantai",
  "yichang",
  "yinchuan",
  "zhangjiajie",
  "zhengzhou",
  "zhuhai",
  "zunyi",
]);

const minLng = 73;
const maxLng = 135;
const minLat = 18;
const maxLat = 54;

function escapeSwiftString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function normalizedCoordinate(value, min, max) {
  return Math.min(0.94, Math.max(0.06, (value - min) / (max - min)));
}

function accentFor(city) {
  if (["zhejiang", "shandong", "henan", "guangdong", "hongkong", "macau", "shanghai"].includes(city.provinceId)) {
    return ".bloom";
  }
  if (city.id.startsWith("city-")) return ".dim";

  const accents = [".sky", ".softMint", ".sakura", ".bloom"];
  let hash = 0;
  for (const char of city.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  return accents[hash % accents.length];
}

const rows = cityData.map((city) => {
  const x = normalizedCoordinate(city.lng, minLng, maxLng);
  const y = 1 - normalizedCoordinate(city.lat, minLat, maxLat);

  return `        MapCity(id: "${escapeSwiftString(city.id)}", name: "${escapeSwiftString(city.name)}", nameEn: "${escapeSwiftString(city.nameEn)}", provinceId: "${escapeSwiftString(city.provinceId)}", province: "${escapeSwiftString(provinceName.get(city.provinceId) ?? city.provinceId)}", landmark: "${escapeSwiftString(city.landmark)}", lng: ${Number(city.lng).toFixed(6)}, lat: ${Number(city.lat).toFixed(6)}, x: ${x.toFixed(6)}, y: ${Math.min(0.94, Math.max(0.06, y)).toFixed(6)}, isFeatured: ${featuredIds.has(city.id) ? "true" : "false"}, accent: ${accentFor(city)})`;
});

const output = `import SwiftUI

// Generated from data/cities.ts and data/provinces.ts.
// Coordinates are normalized for the prototype SwiftUI map surface.
extension MapCity {
    static let all: [MapCity] = [
${rows.join(",\n")}
    ]
}
`;

fs.writeFileSync("ios/MapOfUs/MapOfUs/CityCatalog.swift", output);
console.log(`Generated ${cityData.length} cities`);
