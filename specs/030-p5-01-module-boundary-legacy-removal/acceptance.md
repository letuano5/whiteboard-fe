# Acceptance Criteria

AC-1: Search codebase no longer finds any saved-room handler that handles `ELEMENT_UPDATE` by directly mutating room memory, document clocks, autosave state, or database records outside the backend sync module.
AC-2: All saved-room mutation tests for realtime element updates and native-file import exercise the sync module entrypoint instead of asserting direct handler or direct repository mutation behavior.
AC-3: Legacy whole-element helpers and `ELEMENT_UPDATE` compatibility paths remain only as adapter/local/cross-tab/migration surfaces with comments that explicitly state their limited scope.
