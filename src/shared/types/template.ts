import type { Rule } from './rule';
import type { Container } from './container';

export interface ContainerTemplateMetadata extends NonNullable<Container['metadata']> { }

export interface ContainerTemplate {
  name: string;
  color: string;
  icon: string;
  metadata?: ContainerTemplateMetadata;
  starterRules?: Array<Partial<Rule> & Pick<Rule, 'pattern' | 'matchType' | 'ruleType'>>;
}





