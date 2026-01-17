export interface UserProps {
  telegramId: number;
  globalPrompt?: string;
  dictionary: string[];
  createdAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  get telegramId(): number {
    return this.props.telegramId;
  }

  get globalPrompt(): string | undefined {
    return this.props.globalPrompt;
  }

  get dictionary(): string[] {
    return [...this.props.dictionary];
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(props: Omit<UserProps, "createdAt" | "dictionary"> & Partial<Pick<UserProps, "dictionary">>): User {
    return new User({
      ...props,
      dictionary: props.dictionary ?? [],
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  updateGlobalPrompt(prompt: string | undefined): User {
    return new User({
      ...this.props,
      globalPrompt: prompt,
    });
  }

  addToDictionary(word: string): User {
    if (this.props.dictionary.includes(word)) {
      return this;
    }
    return new User({
      ...this.props,
      dictionary: [...this.props.dictionary, word],
    });
  }

  removeFromDictionary(word: string): User {
    return new User({
      ...this.props,
      dictionary: this.props.dictionary.filter((w) => w !== word),
    });
  }

  toJSON(): UserProps {
    return { ...this.props };
  }
}
