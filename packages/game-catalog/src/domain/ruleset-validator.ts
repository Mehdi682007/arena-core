import { assertRulesetConfig } from './catalog-policies';
import type { RulesetConfig } from './catalog-types';

export interface GameRulesetValidator {
  validate(configuration: RulesetConfig): void;
}

export interface GameRulesetValidatorRegistry {
  validatorFor(gameKey: string): GameRulesetValidator;
}

export class GenericGameRulesetValidator implements GameRulesetValidator {
  public validate(configuration: RulesetConfig): void {
    assertRulesetConfig(configuration);
  }
}

export class GenericGameRulesetValidatorRegistry implements GameRulesetValidatorRegistry {
  private readonly validator = new GenericGameRulesetValidator();

  public validatorFor(gameKey: string): GameRulesetValidator {
    void gameKey;
    return this.validator;
  }
}
