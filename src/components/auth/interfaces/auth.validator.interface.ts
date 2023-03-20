interface IAuthValidator {
  validationToken(token: string): Promise<void>;
}

export default IAuthValidator;
