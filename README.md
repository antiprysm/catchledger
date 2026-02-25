# CatchLedger

CatchLedger is a mobile-first accounting and compliance app built specifically for licensed fish distributors, commercial fishermen, and seafood wholesalers.

The directive of this application is simple:

Provide a clean, practical, fisherman-friendly way to track catches, sales, expenses, and compliance — without the complexity of generic accounting software.

CatchLedger is designed to be professional, maritime-themed, and usable by older fishermen who value clarity over trendiness.

## Project Directive

Commercial fishing operations often rely on paper logs, spreadsheets, or overly complex accounting platforms. CatchLedger aims to:

Digitize catch logging

Track daily sales

Monitor expenses

Maintain compliance records

Provide simple reporting

Prepare data for tax and regulatory purposes

Eventually enable marketplace-style transactions between licensed parties

The goal is accuracy, simplicity, and reliability at the dock.

## Core Features (MVP)
1. Catch Logging

Record species

Weight (lbs/kg)

Date & time

Dock / landing location

Buyer information

Notes

2. Sales Tracking

Track price per pound

Auto-calculate totals

Buyer management

Payment status tracking

3. Expense Management

Fuel

Ice

Dock fees

Maintenance

Crew pay

Custom expense categories

4. Compliance Support

Organized catch records

Exportable reports

Structured logs for regulatory review

5. Reporting

Daily summaries

Weekly totals

Monthly breakdowns

Profit overview

6. Offline-First Design

Works without internet

Syncs when connection is available

Reliable for dockside usage

## Technology Stack

Frontend

React Native (Expo)

TypeScript

Context-based theming (Light / Dark maritime themes)

Backend

Node.js (Express)

PostgreSQL

Secure REST API

Environment variable configuration (.env)

Security

Local secure storage for sensitive data

Encrypted API communication

Input validation & SQL injection protection

## Design Philosophy

CatchLedger follows a maritime aesthetic:

Navy blue

Sea green

Sand/beige accents

Clear typography

Large readable buttons

Practical layout over flashy UI

Designed for:

Real dock environments

Gloved hands

Bright outdoor lighting

Older users

## Getting Started
Prerequisites

Node.js ≥ 18

Expo CLI

PostgreSQL

Android Studio or Xcode (for native builds)

## Installation
git clone https://github.com/yourusername/CatchLedger.git
cd CatchLedger
npm install
Start Development Server
npx expo start
Run on Android
npx expo run:android
Run on iOS
npx expo run:ios
##Project Structure
/app              → Application screens
/components       → Reusable UI components
/utils            → Helpers and business logic
/constants        → Static values
/theme            → Light/Dark theme system
/api              → Backend integration
##Environment Configuration

Create a .env file in the root directory:

API_BASE_URL=http://localhost:3000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=catchledger
##Roadmap

Marketplace between licensed distributors

Invoice generation

Export to CSV / PDF

Analytics dashboard

Cloud sync accounts

Multi-user boat accounts

Stripe or ACH integration

Inventory forecasting

## Vision

CatchLedger is not just accounting software.

It is infrastructure for independent fishermen.

It aims to:

Preserve small operators

Simplify compliance

Increase transparency

Strengthen local seafood economies

## License

MIT License