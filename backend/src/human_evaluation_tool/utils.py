"""
Copyright (C) 2023-2025 Yaraku, Inc.

This file is part of Human Evaluation Tool.

Human Evaluation Tool is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 3 of the License,
or (at your option) any later version.

Human Evaluation Tool is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.

Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, August 2023
"""

from __future__ import annotations

from typing import Final


CATEGORY_NAME: Final[dict[str, str]] = {
    "000": "No Error",
    "A01": "Accuracy/Mistranslation",
    "A02": "Accuracy/Overtranslation",
    "A03": "Accuracy/Undertranslation",
    "A04": "Accuracy/Omission",
    "A05": "Accuracy/Addition",
    "A06": "Accuracy/Transposition",
    "A07": "Accuracy/Untranslated",
    "A08": "Accuracy/Gibberish",
    "A09": "Accuracy/Other",
    "L01": "Linguist conventions/Grammar and syntax",
    "L02": "Linguist conventions/Punctuation",
    "L03": "Linguist conventions/Spelling",
    "L04": "Linguist conventions/Character",
    "L05": "Linguist conventions/Others",
    "T01": "Terminology/Inconsistent with terminology resources",
    "T02": "Terminology/Wrong term",
    "T03": "Terminology/Inconsistent use",
    "T04": "Terminology/Other",
    "S01": "Style/Textual conventions",
    "S02": "Style/Register",
    "S03": "Style/Lack of clarity",
    "S04": "Style/Conciseness",
    "S05": "Style/Unidiomatic",
    "S06": "Style/Coherence and cohesion",
    "S07": "Style/Inconsistent with external reference",
    "S08": "Style/Others",
    "LC1": "Locale/Locale convention",
    "P01": "Audience appropriateness/Culture-specific reference",
    "P02": "Audience appropriateness/Offensive",
    "P03": "Audience appropriateness/Other",
    "SE1": "SourceError/Source Error",
}

SEVERITY_NAME: Final[dict[str, str]] = {
    "no-error": "no-error",
    "critical": "Critical",
    "minor": "Minor",
    "major": "Major",
    "not-judgeable": "NotJudgeable",
}
