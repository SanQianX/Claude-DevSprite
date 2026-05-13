# Design Checker Module

## Description
Background scanner that checks design-code consistency

## Trigger
Periodic scanning (configurable interval, default 10 minutes)

## Inputs
- Design documents (tasks/ directory)
- Knowledge base documents
- Source code files

## Outputs
- Inconsistency report (saved to database with findings)

## Usage
Automatically runs in background; can be configured via updateConfig()
