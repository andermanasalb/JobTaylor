import type { JobEnrichmentPort, EnrichedJob } from '../../features/job-postings/application/ports/JobEnrichmentPort'

/**
 * Implementación fake para Stage 0 y tests.
 * Devuelve datos enriquecidos estáticos sin llamadas de red.
 */
export class FakeEnrichmentAdapter implements JobEnrichmentPort {
  async enrich(_url: string): Promise<EnrichedJob> {
    return {
      description:
        'Esta es una excelente oportunidad para unirse a un equipo dinámico y en crecimiento. ' +
        'El candidato seleccionado trabajará en proyectos desafiantes con impacto real en el producto. ' +
        'Se valora la proactividad, el trabajo en equipo y las ganas de aprender. ' +
        'El ambiente de trabajo es colaborativo y se fomenta el desarrollo profesional continuo.',
      requirements: [
        '3+ años de experiencia relevante',
        'Dominio de las tecnologías del stack',
        'Capacidad para trabajar de forma autónoma',
        'Buenas habilidades de comunicación',
      ],
      niceToHave: [
        'Experiencia en entornos ágiles (Scrum/Kanban)',
        'Contribuciones a proyectos open source',
        'Conocimiento de inglés técnico',
      ],
      techStack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      aboutCompany:
        'Empresa tecnológica en plena expansión con presencia en varios países europeos. ' +
        'Apuesta por la innovación y el desarrollo de talento interno.',
    }
  }
}
