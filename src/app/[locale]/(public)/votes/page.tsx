import { redirect } from 'next/navigation';

export default function VotesPageRedirect() {
  redirect('/legislation');
}
