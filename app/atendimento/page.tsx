import { redirect } from 'next/navigation';

// O atendimento ao cliente vive em /ajuda
export default function AtendimentoPage() {
  redirect('/ajuda');
}
