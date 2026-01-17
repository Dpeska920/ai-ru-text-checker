import type { UseCase } from "@/shared/core";
import { Result } from "@/shared/core";
import type { ManageDictionaryRequest, ManageDictionaryResponse } from "./manage-dictionary.dto";
import type { UserRepository } from "@/application/ports";
import { User } from "@/domain/entities";

export class ManageDictionaryUseCase implements UseCase<ManageDictionaryRequest, ManageDictionaryResponse> {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(request: ManageDictionaryRequest): Promise<Result<ManageDictionaryResponse>> {
    const { user, action, word } = request;

    switch (action) {
      case "list":
        return this.listDictionary(user);

      case "add":
        if (!word?.trim()) {
          return Result.fail("Word is required for add action");
        }
        return this.addWord(user, word.trim().toLowerCase());

      case "remove":
        if (!word?.trim()) {
          return Result.fail("Word is required for remove action");
        }
        return this.removeWord(user, word.trim().toLowerCase());

      case "clear":
        return this.clearDictionary(user);

      default:
        return Result.fail(`Unknown action: ${action}`);
    }
  }

  private async listDictionary(user: User): Promise<Result<ManageDictionaryResponse>> {
    const dictionary = user.dictionary;

    if (dictionary.length === 0) {
      return Result.ok({
        dictionary: [],
        message: "Your dictionary is empty. Use /dict add <word> to add words.",
      });
    }

    return Result.ok({
      dictionary,
      message: `Your dictionary (${dictionary.length} words):\n${dictionary.join(", ")}`,
    });
  }

  private async addWord(user: User, word: string): Promise<Result<ManageDictionaryResponse>> {
    if (user.dictionary.includes(word)) {
      return Result.ok({
        dictionary: user.dictionary,
        message: `Word "${word}" is already in your dictionary.`,
      });
    }

    const updatedUser = user.addToDictionary(word);
    await this.userRepository.save(updatedUser);

    return Result.ok({
      dictionary: updatedUser.dictionary,
      message: `Added "${word}" to your dictionary.`,
    });
  }

  private async removeWord(user: User, word: string): Promise<Result<ManageDictionaryResponse>> {
    if (!user.dictionary.includes(word)) {
      return Result.ok({
        dictionary: user.dictionary,
        message: `Word "${word}" is not in your dictionary.`,
      });
    }

    const updatedUser = user.removeFromDictionary(word);
    await this.userRepository.save(updatedUser);

    return Result.ok({
      dictionary: updatedUser.dictionary,
      message: `Removed "${word}" from your dictionary.`,
    });
  }

  private async clearDictionary(user: User): Promise<Result<ManageDictionaryResponse>> {
    if (user.dictionary.length === 0) {
      return Result.ok({
        dictionary: [],
        message: "Your dictionary is already empty.",
      });
    }

    let updatedUser = user;
    for (const word of user.dictionary) {
      updatedUser = updatedUser.removeFromDictionary(word);
    }
    await this.userRepository.save(updatedUser);

    return Result.ok({
      dictionary: [],
      message: "Your dictionary has been cleared.",
    });
  }
}
