import React from 'react';
import {
  CategoryIconType,
  SubcategoryVisualType,
  SymbolKey,
  VehicleIconKey,
} from '../../types/radar';

export interface VehicleIconOption {
  key: VehicleIconKey;
  label: string;
}

export const VEHICLE_ICON_OPTIONS: VehicleIconOption[] = [
  { key: 'pm', label: 'Polícia Militar (PM)' },
  { key: 'gcm', label: 'Guarda Civil (GCM)' },
  { key: 'policia_civil', label: 'Polícia Civil' },
  { key: 'auto_bomba', label: 'Caminhão Auto-Bomba' },
  { key: 'resgate_bombeiros', label: 'Resgate Bombeiros' },
  { key: 'auto_escada', label: 'Auto-Escada' },
  { key: 'samu', label: 'SAMU 192' },
  { key: 'uti_movel', label: 'UTI Móvel' },
  { key: 'ambulancia_resgate', label: 'Ambulância Resgate' },
  { key: 'enel', label: 'Energia (Enel)' },
  { key: 'claro', label: 'Telecom (Claro)' },
  { key: 'vivo', label: 'Telecom (Vivo)' },
  { key: 'moto', label: 'Moto Urbana' },
  { key: 'carro_prata', label: 'Carro Prata/Branco' },
  { key: 'carro_colorido', label: 'Carro Colorido' },
];

export const SYMBOL_OPTIONS: { key: SymbolKey; label: string }[] = [
  { key: 'alert_triangle', label: 'Triângulo de Alerta' },
  { key: 'box_send', label: 'Caixa Saída / Envio' },
  { key: 'box_receive', label: 'Caixa Entrada / Recebimento' },
  { key: 'truck_fast', label: 'Entrega Expressa' },
  { key: 'clock_wait', label: 'Prioridade / Aguardando' },
  { key: 'check_ok', label: 'Conferência Concluída' },
  { key: 'shield', label: 'Segurança / Escudo' },
  { key: 'wrench', label: 'Manutenção / Suporte' },
];

export function getVehicleSvgMarkup(iconKey: VehicleIconKey): string {
  switch (iconKey) {
    case 'pm':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="13" width="16" height="5" rx="2" fill="#EF4444"/>
        <rect x="31" y="13" width="9" height="5" rx="2" fill="#3B82F6"/>
        <path d="M14 27L20 18H44L50 27H14Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="8" y="27" width="48" height="16" rx="4" fill="#1E293B" stroke="#0F172A" stroke-width="2.5"/>
        <rect x="10" y="32" width="44" height="5" fill="#F8FAFC"/>
        <rect x="26" y="32" width="12" height="5" fill="#DC2626"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'gcm':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="13" width="16" height="5" rx="2" fill="#2563EB"/>
        <path d="M14 27L20 18H44L50 27H14Z" fill="#DBEAFE" stroke="#1E3A8A" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="8" y="27" width="48" height="16" rx="4" fill="#1D4ED8" stroke="#1E3A8A" stroke-width="2.5"/>
        <rect x="10" y="33" width="44" height="4" fill="#FACC15"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'policia_civil':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="27" y="14" width="10" height="4" rx="2" fill="#EF4444"/>
        <path d="M13 28L20 18H44L51 28H13Z" fill="#334155" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="8" y="28" width="48" height="15" rx="4" fill="#0F172A" stroke="#020617" stroke-width="2.5"/>
        <path d="M29 31L32 34L35 31V37L32 39L29 37V31Z" fill="#FACC15"/>
        <circle cx="19" cy="45" r="6" fill="#1E293B" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#1E293B" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'auto_bomba':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="40" y="14" width="8" height="4" rx="1.5" fill="#FACC15"/>
        <rect x="8" y="21" width="30" height="22" rx="3" fill="#DC2626" stroke="#7F1D1D" stroke-width="2.5"/>
        <path d="M38 22H50L55 31V43H38V22Z" fill="#EF4444" stroke="#7F1D1D" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="42" y="25" width="8" height="7" rx="1.5" fill="#E0F2FE"/>
        <rect x="12" y="26" width="22" height="10" rx="1.5" fill="#F8FAFC"/>
        <line x1="12" y1="31" x2="34" y2="31" stroke="#CBD5E1" stroke-width="2"/>
        <circle cx="18" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="46" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'resgate_bombeiros':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="26" y="13" width="12" height="4" rx="2" fill="#EF4444"/>
        <path d="M10 21H43L53 31V43H10V21Z" fill="#DC2626" stroke="#7F1D1D" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="37" y="24" width="10" height="8" rx="1.5" fill="#E0F2FE"/>
        <rect x="15" y="33" width="36" height="4" fill="#FACC15"/>
        <path d="M22 24H26V27H29V31H26V34H22V31H19V27H22V24Z" fill="#FFFFFF"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'auto_escada':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 24L40 12L42 16L12 28L10 24Z" fill="#E2E8F0" stroke="#475569" stroke-width="2"/>
        <rect x="8" y="28" width="32" height="15" rx="3" fill="#B91C1C" stroke="#7F1D1D" stroke-width="2.5"/>
        <path d="M40 25H51L55 33V43H40V25Z" fill="#DC2626" stroke="#7F1D1D" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="43" y="28" width="8" height="6" rx="1" fill="#E0F2FE"/>
        <circle cx="18" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="46" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'samu':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="26" y="13" width="12" height="4" rx="2" fill="#DC2626"/>
        <path d="M10 20H42L53 31V43H10V20Z" fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="37" y="23" width="10" height="8" rx="1.5" fill="#BAE6FD"/>
        <rect x="11" y="34" width="40" height="5" fill="#EA580C"/>
        <rect x="11" y="31" width="40" height="3" fill="#DC2626"/>
        <path d="M22 23H26V25.5H28.5V29.5H26V32H22V29.5H19.5V25.5H22V23Z" fill="#DC2626"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'uti_movel':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="13" width="14" height="4" rx="2" fill="#2563EB"/>
        <rect x="8" y="19" width="33" height="24" rx="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
        <path d="M41 24H51L55 32V43H41V24Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="44" y="27" width="7" height="6" rx="1" fill="#BAE6FD"/>
        <path d="M14 31H20L22 26L25 36L28 29L30 31H35" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="18" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="46" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'ambulancia_resgate':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="26" y="13" width="12" height="4" rx="2" fill="#F97316"/>
        <path d="M10 21H42L53 31V43H10V21Z" fill="#F8FAFC" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="37" y="24" width="10" height="7" rx="1.5" fill="#BAE6FD"/>
        <rect x="11" y="34" width="40" height="4" fill="#2563EB"/>
        <path d="M22 24H26V26.5H28.5V30.5H26V33H22V30.5H19.5V26.5H22V24Z" fill="#EA580C"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'enel':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="14" width="24" height="5" rx="1.5" fill="#F59E0B" stroke="#92400E" stroke-width="1.5"/>
        <path d="M10 22H42L52 31V43H10V22Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="37" y="25" width="9" height="7" rx="1" fill="#BAE6FD"/>
        <path d="M25 25L20 32H25L23 39L30 30H25L27 25H25Z" fill="#0EA5E9"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'claro':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="15" width="22" height="4" rx="1.5" fill="#DC2626"/>
        <path d="M10 22H42L52 31V43H10V22Z" fill="#FFFFFF" stroke="#991B1B" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="11" y="34" width="40" height="5" fill="#DC2626"/>
        <rect x="37" y="25" width="9" height="7" rx="1" fill="#BAE6FD"/>
        <circle cx="24" cy="29" r="4" fill="#DC2626"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'vivo':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="15" width="22" height="4" rx="1.5" fill="#7C3AED"/>
        <path d="M10 22H42L52 31V43H10V22Z" fill="#FFFFFF" stroke="#4C1D95" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="11" y="34" width="40" height="5" fill="#6D28D9"/>
        <rect x="37" y="25" width="9" height="7" rx="1" fill="#BAE6FD"/>
        <path d="M21 26C21 24.5 23 23.5 24.5 24.5C26 25.5 26 28.5 24 29.5C22 30.5 21 28 21 26Z" fill="#7C3AED"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'moto':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="17" cy="43" r="8" fill="#0F172A" stroke="#F8FAFC" stroke-width="2.5"/>
        <circle cx="47" cy="43" r="8" fill="#0F172A" stroke="#F8FAFC" stroke-width="2.5"/>
        <path d="M17 43L27 30H39L47 43" stroke="#334155" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 29H36L41 22H46" stroke="#EA580C" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="11" y="23" width="12" height="9" rx="2" fill="#F59E0B" stroke="#0F172A" stroke-width="2"/>
      </svg>`;

    case 'carro_prata':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 29L21 20H43L50 29H14Z" fill="#E2E8F0" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="8" y="29" width="48" height="14" rx="4" fill="#CBD5E1" stroke="#334155" stroke-width="2.5"/>
        <rect x="21" y="22" width="22" height="6" rx="1.5" fill="#94A3B8"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;

    case 'carro_colorido':
    default:
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 29L21 20H43L50 29H14Z" fill="#93C5FD" stroke="#1E3A8A" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="8" y="29" width="48" height="14" rx="4" fill="#2563EB" stroke="#1E3A8A" stroke-width="2.5"/>
        <rect x="21" y="22" width="22" height="6" rx="1.5" fill="#DBEAFE"/>
        <circle cx="19" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
        <circle cx="45" cy="45" r="6" fill="#0F172A" stroke="#F8FAFC" stroke-width="2"/>
      </svg>`;
  }
}

export function getSymbolSvgMarkup(symbolKey: SymbolKey, colorHex: string = '#2563EB'): string {
  switch (symbolKey) {
    case 'alert_triangle':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 9L57 52H7L32 9Z" fill="#DC2626" stroke="#7F1D1D" stroke-width="3" stroke-linejoin="round"/>
        <rect x="29.5" y="23" width="5" height="16" rx="2.5" fill="#FFFFFF"/>
        <circle cx="32" cy="44.5" r="3" fill="#FFFFFF"/>
      </svg>`;

    case 'box_send':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="22" width="36" height="30" rx="4" fill="${colorHex}" stroke="#0F172A" stroke-width="2.5"/>
        <path d="M10 30H46" stroke="#FFFFFF" stroke-width="2.5"/>
        <path d="M39 14L54 14M54 14L47 7M54 14L47 21" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'box_receive':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="24" width="36" height="28" rx="4" fill="${colorHex}" stroke="#0F172A" stroke-width="2.5"/>
        <path d="M14 32H50" stroke="#FFFFFF" stroke-width="2.5"/>
        <path d="M32 8V22M32 22L25 15M32 22L39 15" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'truck_fast':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="20" width="32" height="22" rx="3" fill="${colorHex}" stroke="#0F172A" stroke-width="2.5"/>
        <path d="M40 26H51L56 34V42H40V26Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="19" cy="45" r="5.5" fill="#0F172A" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="47" cy="45" r="5.5" fill="#0F172A" stroke="#FFFFFF" stroke-width="2"/>
      </svg>`;

    case 'clock_wait':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="22" fill="#FEF3C7" stroke="${colorHex}" stroke-width="3.5"/>
        <path d="M32 19V33L41 38" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'check_ok':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="22" fill="${colorHex}" stroke="#064E3B" stroke-width="2.5"/>
        <path d="M21 33L29 41L44 24" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'shield':
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 9L52 17V31C52 44 43 52 32 56C21 52 12 44 12 31V17L32 9Z" fill="${colorHex}" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M25 32L30 37L40 26" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'wrench':
    default:
      return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="22" fill="#F1F5F9" stroke="${colorHex}" stroke-width="3"/>
        <path d="M39 19C35 19 32 22 32 26C32 27 32.2 28 32.6 28.8L20 41.4L22.6 44L35.2 31.4C36 31.8 37 32 38 32C42 32 45 29 45 25C45 24 44.7 23 44.2 22.2L40 26.4L37.6 24L41.8 19.8C41 19.3 40 19 39 19Z" fill="#0F172A"/>
      </svg>`;
  }
}

export function getCategorySvgMarkup(
  iconType: CategoryIconType,
  colorHex: string,
  emoji?: string
): string {
  if (iconType === 'custom_emoji' && emoji) {
    return `<div style="font-size:26px;line-height:1;">${emoji}</div>`;
  }
  switch (iconType) {
    case 'package_out':
      return getSymbolSvgMarkup('box_send', colorHex);
    case 'package_in':
      return getSymbolSvgMarkup('box_receive', colorHex);
    case 'alert_triangle':
      return getSymbolSvgMarkup('alert_triangle', colorHex);
    case 'car':
      return getVehicleSvgMarkup('carro_colorido');
    default:
      return getSymbolSvgMarkup('box_send', colorHex);
  }
}

export interface OccurrenceVisualSpec {
  visualType: SubcategoryVisualType;
  vehicleIconKey?: VehicleIconKey;
  symbolKey?: SymbolKey;
  emoji?: string;
  customImageDataUrl?: string;
  colorHex: string;
  pulseEffect?: boolean;
}

export function getOccurrenceInnerHtml(spec: OccurrenceVisualSpec): string {
  if (spec.visualType === 'photo' && spec.customImageDataUrl) {
    return `<img src="${spec.customImageDataUrl}" alt="Ocorrência" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;" />`;
  }
  if (spec.visualType === 'emoji' && spec.emoji) {
    return `<span style="font-size:24px;line-height:1;">${spec.emoji}</span>`;
  }
  if (spec.visualType === 'alert_triangle') {
    return `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">${getSymbolSvgMarkup('alert_triangle', '#DC2626')}</div>`;
  }
  if (spec.visualType === 'symbol') {
    return `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;">${getSymbolSvgMarkup(spec.symbolKey || 'box_send', spec.colorHex)}</div>`;
  }
  return `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;">${getVehicleSvgMarkup(spec.vehicleIconKey || 'carro_colorido')}</div>`;
}

export function getOccurrencePinHtml(
  spec: OccurrenceVisualSpec,
  isExpired?: boolean,
  isMatchedTarget?: boolean,
  tag?: string,
  isShadowMode?: boolean
): string {
  const ringColor = isShadowMode
    ? '#64748B'
    : isExpired
    ? '#64748B'
    : isMatchedTarget
    ? '#D97706'
    : spec.colorHex || '#1D4ED8';
  const pulseClass = !isShadowMode && spec.pulseEffect ? 'radar-pin-pulse' : '';
  const innerContent = getOccurrenceInnerHtml(spec);
  const shadowStyle = isShadowMode
    ? 'opacity:0.62;filter:grayscale(85%) drop-shadow(0 2px 4px rgba(15,23,42,0.22));'
    : 'filter:drop-shadow(0 4px 8px rgba(15,23,42,0.38));';
  const tagBadge = tag
    ? `<div style="margin-top:2px;padding:1px 6px;border-radius:6px;background:${
        isShadowMode ? '#475569' : isMatchedTarget ? '#92400E' : '#0F172A'
      };color:#FFFFFF;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;white-space:nowrap;border:1.5px solid #FFFFFF;box-shadow:0 2px 4px rgba(15,23,42,0.3);">${tag}</div>`
    : '';

  return `
    <div class="${pulseClass}" style="position:relative;width:46px;height:52px;display:flex;flex-direction:column;align-items:center;${shadowStyle}">
      <div style="width:44px;height:44px;border-radius:9999px;background:#FFFFFF;border:3.5px solid ${ringColor};display:flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box;${
        !isShadowMode && isMatchedTarget
          ? 'box-shadow:0 0 0 3px rgba(245,158,11,0.5);'
          : ''
      }">
        ${innerContent}
      </div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${ringColor};margin-top:-2px;"></div>
      ${tagBadge}
    </div>
  `;
}

export function getStorePinHtml(
  isAlerting: boolean,
  alertCount: number,
  isOpen: boolean = false
): string {
  const bg = isAlerting ? '#DC2626' : isOpen ? '#059669' : '#64748B';
  const ring = isAlerting ? '#FEE2E2' : isOpen ? '#D1FAE5' : '#E2E8F0';
  const badgeHtml = isAlerting
    ? `<span style="position:absolute;top:-5px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:9999px;background:#FACC15;color:#0F172A;border:2px solid #7F1D1D;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">${alertCount}</span>`
    : isOpen
    ? `<span style="position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:9999px;background:#10B981;border:2px solid #FFFFFF;"></span>`
    : '';

  return `
    <div class="${isAlerting ? 'radar-pin-pulse' : ''}" style="position:relative;width:44px;height:48px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(15,23,42,0.35));">
      <div style="width:40px;height:40px;border-radius:12px;background:${bg};border:2.5px solid ${ring};display:flex;align-items:center;justify-content:center;color:#FFFFFF;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l1-5h16l1 5"/>
          <path d="M4 9v11h16V9"/>
          <path d="M9 20v-6h6v6"/>
        </svg>
      </div>
      ${badgeHtml}
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${bg};margin-top:-1px;"></div>
    </div>
  `;
}

interface OccurrenceAvatarProps {
  spec: OccurrenceVisualSpec;
  alt: string;
  className?: string;
}

export const OccurrenceAvatar: React.FC<OccurrenceAvatarProps> = ({
  spec,
  alt,
  className = 'w-11 h-11',
}) => {
  if (spec.visualType === 'photo' && spec.customImageDataUrl) {
    return (
      <div
        className={`${className} rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0`}
      >
        <img
          src={spec.customImageDataUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} ${
        spec.pulseEffect ? 'radar-pin-pulse' : ''
      } rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shrink-0`}
      dangerouslySetInnerHTML={{ __html: getOccurrenceInnerHtml(spec) }}
      aria-label={alt}
    />
  );
};

export const CategoryAvatar: React.FC<{
  iconType: CategoryIconType;
  colorHex: string;
  emoji?: string;
  alt: string;
  className?: string;
}> = ({ iconType, colorHex, emoji, alt, className = 'w-11 h-11' }) => {
  return (
    <div
      className={`${className} rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shrink-0`}
      dangerouslySetInnerHTML={{
        __html: getCategorySvgMarkup(iconType, colorHex, emoji),
      }}
      aria-label={alt}
    />
  );
};

export const VehicleAvatar: React.FC<{
  iconKey: VehicleIconKey;
  customImageDataUrl?: string;
  alt: string;
  className?: string;
}> = ({ iconKey, customImageDataUrl, alt, className = 'w-11 h-11' }) => {
  return (
    <OccurrenceAvatar
      spec={{
        visualType: customImageDataUrl ? 'photo' : 'vehicle_svg',
        vehicleIconKey: iconKey,
        customImageDataUrl,
        colorHex: '#1E293B',
      }}
      alt={alt}
      className={className}
    />
  );
};
