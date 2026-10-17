#!/usr/bin/env python3
"""Derive the PDF font from the licensed, versioned WOFF2. No network or new source.
Requires FontTools 4.67.0 and Brotli 1.2.0; see apps/web/public/fonts/README.md.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parent.parent
fonts = root / 'apps/web/public/fonts'
font = TTFont(fonts / 'manrope-latin.woff2', recalcTimestamp=False)
font.flavor = None
regular = instantiateVariableFont(font, {'wght': 400}, inplace=False, updateFontNames=True)
regular.recalcTimestamp = False
regular.save(fonts / 'manrope-pdf-regular.ttf')
print('Manrope PDF regular derivada localmente; WOFF2 original preservado.')
