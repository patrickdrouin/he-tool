/*
 * Copyright (C) 2023 Yaraku, Inc.
 *
 * This file is part of Human Evaluation Tool.
 *
 * Human Evaluation Tool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Human Evaluation Tool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.
 *
 * Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, August 2023
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import ErrorCategorySelector from "./ErrorCategorySelector";
import ErrorSeveritySelector from "./ErrorSeveritySelector";

/**
 * A popup component for creating and editing error markings in translations.
 * 
 * @param {Object} props - Component props
 * @param {React.RefObject} props.containerRef - Reference to the container element for positioning
 * @param {Object|null} props.marking - The marking being edited, or null when creating a new marking
 * @param {Selection} props.selection - The current text selection when creating a new marking
 * @param {boolean} props.disabled - Whether the marking controls are disabled
 * @param {number} props.mouseX - Mouse X coordinate for popup positioning
 * @param {number} props.mouseY - Mouse Y coordinate for popup positioning
 * @param {Function} props.createMarking - Callback for creating a new marking
 * @param {Function} props.deleteMarking - Callback for deleting an existing marking
 * @param {Function} props.updateMarking - Callback for updating an existing marking
 * @returns {JSX.Element} The marking popup component
 */
export default function MarkingPopup({
  containerRef,
  marking,
  selection,
  disabled,
  mouseX,
  mouseY,
  markingPosition,
  markingCount,
  onPrevMarking,
  onNextMarking,
  createMarking,
  deleteMarking,
  updateMarking,
}) {
  const { x: parentX, y: parentY } = containerRef.getBoundingClientRect();
  const popupRef = useRef(null);
  const [category, setCategory] = useState("000");
  const [severity, setSeverity] = useState("no-error");
  const [comment, setComment] = useState("");

  // After each render, clamp the popup so it doesn't overflow the right or bottom
  // edge of the viewport. useLayoutEffect runs before the browser paints, preventing flicker.
  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    if (rect.right > window.innerWidth - margin) {
      el.style.left = `${Math.max(0, mouseX - parentX - rect.width - margin)}px`;
    }
    if (rect.bottom > window.innerHeight - margin) {
      el.style.top = `${Math.max(0, mouseY - parentY - rect.height - margin)}px`;
    }
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (marking) {
      setCategory(marking.errorCategory);
      setSeverity(marking.errorSeverity);
      setComment(marking.comment || "");
    } else {
      setCategory("000");
      setSeverity("no-error");
      setComment("");
    }
  }, [marking, selection]);

  return (
    <div
      ref={popupRef}
      className="tw-absolute tw-z-[1002] tw-select-none tw-divide-y tw-divide-solid tw-rounded-md tw-bg-white tw-p-2 tw-shadow-card"
      style={{
        left: `${mouseX - parentX + 8}px`,
        top: `${mouseY - parentY + 10}px`,
      }}
    >
      <div className="tw-inline-flex tw-flex-col tw-gap-y-1.5 tw-text-sm">
        {marking && markingCount > 1 && (
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-x-2 tw-text-xs tw-text-gray-500">
            <button className="btn btn-sm btn-outline-secondary tw-py-0 tw-px-1.5" onClick={onPrevMarking}>◀</button>
            <span>{markingPosition} / {markingCount}</span>
            <button className="btn btn-sm btn-outline-secondary tw-py-0 tw-px-1.5" onClick={onNextMarking}>▶</button>
          </div>
        )}
        <div className="tw-inline-flex tw-flex-row tw-gap-x-1.5">
          <ErrorCategorySelector
            className="btn btn-outline-dark"
            disabled={marking ? !marking.id || disabled : disabled}
            onChange={(e) => {
              if (marking) {
                updateMarking({
                  marking,
                  category: e.target.value,
                  severity: marking.errorSeverity,
                  comment,
                });
              } else {
                setCategory(e.target.value);
              }
            }}
            value={category}
          />
          <ErrorSeveritySelector
            className="btn btn-outline-dark"
            disabled={marking ? !marking.id || disabled : disabled}
            onChange={(e) => {
              if (marking) {
                updateMarking({
                  marking,
                  category: marking.errorCategory,
                  severity: e.target.value,
                  comment,
                });
              } else {
                setSeverity(e.target.value);
              }
            }}
            value={severity}
          />
          {marking ? (
            <button
              className="btn btn-primary"
              disabled={marking ? !marking.id || disabled : disabled}
              onClick={() => deleteMarking({ marking })}
            >
              -
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                createMarking({
                  start: selection?.start,
                  end: selection?.end,
                  category,
                  severity,
                  comment,
                });
              }}
            >
              OK
            </button>
          )}
        </div>
        <textarea
          className="form-control tw-text-sm tw-mt-1"
          disabled={marking ? !marking.id || disabled : disabled}
          placeholder="Commentaire (optionnel)"
          rows={2}
          style={{ minWidth: "220px" }}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => {
            if (marking) {
              updateMarking({
                marking,
                category: marking.errorCategory,
                severity: marking.errorSeverity,
                comment,
              });
            }
          }}
        />
      </div>
    </div>
  );
}
