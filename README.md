# College Connect 🎓

### Smart College Management & Campus Operations Platform

College Connect is a modern college management and campus operations web application designed to simplify academic scheduling, classroom management, room reservations and campus communication.

## Features

- Live college status dashboard
- Branch-wise academic timetables
- Classroom and laboratory availability
- Room booking and approval management
- Holiday and vacation calendar
- Campus announcements
- Administrative dashboard
- Excel and CSV timetable imports
- Scheduling conflict detection
- Supabase authentication
- PostgreSQL database
- Progressive Web App support

## Technology Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Auth
- SheetJS
- Vitest
- Vercel

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/avrendrakumar/college-connect.git
cd college-connect
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Supabase

Create a project at https://supabase.com/

Run these SQL migrations in order through the Supabase SQL Editor:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_room_bookings.sql`

### 4. Configure environment variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_public_anon_key
```

Never expose your Supabase service-role key.

### 5. Start development

```bash
npm run dev
```

### 6. Production build

```bash
npm run build
```

## Deployment

This project includes Vercel configuration.

1. Push the repository to GitHub.
2. Import it into Vercel.
3. Configure the Supabase environment variables.
4. Deploy the application.

## Security

- Supabase authentication
- PostgreSQL Row Level Security
- Role-based administrator access
- Environment variable protection

## Future Improvements

- Student dashboards
- Faculty management
- Attendance management
- Academic analytics
- Push notifications

## Project Information

**Project:** College Connect  
**Category:** College Management / Campus Operations  
**Frontend:** React + TypeScript  
**Backend:** Supabase  
**Database:** PostgreSQL

## License

No open-source license has been assigned yet. Contact ME for permission before redistribution or commercial use.
