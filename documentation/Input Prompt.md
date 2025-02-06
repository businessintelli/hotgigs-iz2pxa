1. **Hotgigs is recruitment management system (HotGigs):**

2. recruitment management system (HotGigs):

Core Purpose

Advanced recruitment platform connecting recruiters with candidates

AI-powered matching system for better job-candidate fits

Streamlined hiring workflow management

User Types

Recruiters: Post jobs, manage candidates, schedule interviews, importing millions of resumes like bulk and parsing name , skills , phone number , edication , email etc them and storing them in database

Candidates: Apply for jobs, manage profiles, track applications, importing resume. and parsing data

Guests: View public jobs and submit applications

Key Features

A. For Recruiters

Job posting and management

Candidate pipeline tracking

AI-assisted screening

Interview scheduling

Team collaboration tools

Analytics dashboard

Email template management

Hotlist management

Shared talent pools

B. For Candidates

Profile management

Resume versions

Job search and applications

Interview scheduling

Portfolio management

Skill assessments

Job recommendations

Technical Architecture

Frontend:

React + TypeScript

Tailwind CSS for styling

shadcn/ui component library

Tanstack Query for data management

Backend (Supabase):

PostgreSQL database

Authentication system

Row Level Security

Edge Functions for custom logic

File storage for resumes/documents

Key Integrations

OpenAI for AI features

Google Calendar for scheduling

Email service for notifications

Resume parsing service

Data Structure

25+ tables managing various aspects:

Jobs and applications

User profiles

Interview schedules

Resume versions

Email templates

Analytics data

Security Features

Role-based access control

Row-level security policies

Secure file storage

Token-based authentication

Authentication & User Management

User registration and login system

Profile management for both recruiters and candidates

Role-based access control (recruiter vs candidate)

Recruiter Features

Job posting and management

Candidate pipeline management

Interview scheduling system

Hotlist management for saving potential candidates

Calendar view for interview schedules

Recruiter network for sharing candidates

Email template management

Analytics dashboard

Candidate Features

Resume management with multiple versions

Job search and application

Interview schedule viewing

Profile visibility settings

Portfolio management

Work experience and education tracking

Core Features

AI-powered job matching

Resume parsing and analysis

Email notifications for interviews

Shared talent pools

Advanced search capabilities

Analytics and reporting

Database Structure

Comprehensive tables for:

Applications

Jobs

Profiles

Interview schedules

Resume versions

Email templates

Recruiter networks

And more

Recent Implementations

Interview scheduling system with calendar integration

Hotlist management for recruiters

Calendar view for scheduled interviews

Email notifications for interview scheduling

Current Issues Being Addressed

Interview schedule visibility across different views

Supabase client configuration

TypeScript type definitions in the hotlist management

The application is built with:

React + TypeScript for the frontend

Supabase for backend services

Tailwind CSS + shadcn/ui for styling

Tanstack Query for data fetching

Edge Functions for custom backend logic