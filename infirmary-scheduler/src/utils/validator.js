/**
 * Input Validation Utility
 *
 * Validates infirmary configuration inputs from the HTTP request body
 * before they are passed to the scheduling engine.
 */

"use strict";

const TIME_REGEX = /^(\d{1,2}):(\d{2})(\s*(AM|PM))?$/i;

/**
 * Validates and parses the infirmary configuration object.
 * @param {object} body - raw request body
 * @returns {{ valid: boolean, config: object|null, errors: string[] }}
 */
function validateInfirmaryConfig(body) {
  const errors = [];

  const { startTime, endTime, slotDuration, dailyCapacity } = body;

  // startTime
  if (!startTime || !TIME_REGEX.test(String(startTime).trim())) {
    errors.push("startTime is required and must be in HH:MM or HH:MM AM/PM format.");
  }

  // endTime
  if (!endTime || !TIME_REGEX.test(String(endTime).trim())) {
    errors.push("endTime is required and must be in HH:MM or HH:MM AM/PM format.");
  }

  // slotDuration
  const slotMins = parseInt(slotDuration, 10);
  if (!slotDuration || isNaN(slotMins) || slotMins < 5 || slotMins > 480) {
    errors.push("slotDuration is required and must be an integer between 5 and 480 minutes.");
  }

  // dailyCapacity (optional)
  let capacityVal = null;
  if (dailyCapacity !== undefined && dailyCapacity !== "" && dailyCapacity !== null) {
    capacityVal = parseInt(dailyCapacity, 10);
    if (isNaN(capacityVal) || capacityVal < 1) {
      errors.push("dailyCapacity, if provided, must be a positive integer.");
    }
  }

  if (errors.length > 0) {
    return { valid: false, config: null, errors };
  }

  return {
    valid: true,
    config: {
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      slotDuration: slotMins,
      dailyCapacity: capacityVal,
    },
    errors: [],
  };
}

module.exports = { validateInfirmaryConfig };
