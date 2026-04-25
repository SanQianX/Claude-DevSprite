/**
 * Conflict Resolver
 * Handles merge conflicts in knowledge base
 */

export enum ConflictResolution {
  KeepOurs = 'ours',
  KeepTheirs = 'theirs',
  Merge = 'merge',
  Manual = 'manual',
}

interface ConflictRegion {
  start: number;
  separator: number;
  end: number;
  ours: string;
  theirs: string;
}

export class ConflictResolver {
  /**
   * Detect conflicts in markdown content
   */
  detectConflicts(content: string): boolean {
    return content.includes('<<<<<<<') && content.includes('>>>>>>>');
  }

  /**
   * Count number of conflict regions
   */
  countConflicts(content: string): number {
    return this.parseConflictRegions(content).length;
  }

  /**
   * Resolve all conflicts with specified strategy
   */
  resolveConflict(
    content: string,
    strategy: ConflictResolution
  ): string {
    if (!this.detectConflicts(content)) {
      return content;
    }

    switch (strategy) {
      case ConflictResolution.KeepOurs:
        return this.extractOurs(content);
      case ConflictResolution.KeepTheirs:
        return this.extractTheirs(content);
      case ConflictResolution.Merge:
        return this.mergeSections(content);
      default:
        return content;
    }
  }

  /**
   * Extract "ours" version from conflict markers
   */
  private extractOurs(content: string): string {
    const regions = this.parseConflictRegions(content);
    let result = content;

    // Process in reverse to maintain correct indices
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      result = result.substring(0, region.start) + region.ours + result.substring(region.end);
    }

    return result;
  }

  /**
   * Extract "theirs" version from conflict markers
   */
  private extractTheirs(content: string): string {
    const regions = this.parseConflictRegions(content);
    let result = content;

    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      result = result.substring(0, region.start) + region.theirs + result.substring(region.end);
    }

    return result;
  }

  /**
   * Merge conflicting sections intelligently
   * For knowledge base documents: keep both sections with headers
   */
  private mergeSections(content: string): string {
    const regions = this.parseConflictRegions(content);
    let result = content;

    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      const oursLines = region.ours.trim().split('\n');
      const theirsLines = region.theirs.trim().split('\n');

      // If both sides are identical, just use one
      if (region.ours.trim() === region.theirs.trim()) {
        result = result.substring(0, region.start) + region.ours + result.substring(region.end);
        continue;
      }

      // If one side is empty, use the non-empty one
      if (!region.ours.trim()) {
        result = result.substring(0, region.start) + region.theirs + result.substring(region.end);
        continue;
      }
      if (!region.theirs.trim()) {
        result = result.substring(0, region.start) + region.ours + result.substring(region.end);
        continue;
      }

      // Smart merge: combine unique lines from both sides
      const oursSet = new Set(oursLines.map(l => l.trim()));
      const theirsUnique = theirsLines.filter(l => !oursSet.has(l.trim()));
      const merged = [...oursLines, ...theirsUnique].join('\n');

      result = result.substring(0, region.start) + merged + result.substring(region.end);
    }

    return result;
  }

  /**
   * Parse conflict regions from content
   * Format:
   *   <<<<<<< HEAD (or branch name)
   *   our content
   *   =======
   *   their content
   *   >>>>>>> branch-name
   */
  private parseConflictRegions(content: string): ConflictRegion[] {
    const regions: ConflictRegion[] = [];
    const lines = content.split('\n');

    let conflictStart = -1;
    let separatorIdx = -1;
    let oursLines: string[] = [];
    let theirsLines: string[] = [];
    let inOurs = false;
    let inTheirs = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        conflictStart = i;
        inOurs = true;
        inTheirs = false;
        oursLines = [];
        theirsLines = [];
      } else if (line === '=======' && inOurs) {
        separatorIdx = i;
        inOurs = false;
        inTheirs = true;
      } else if (line.startsWith('>>>>>>>') && inTheirs) {
        // Calculate character positions
        let startChar = 0;
        for (let j = 0; j < conflictStart; j++) {
          startChar += lines[j].length + 1; // +1 for newline
        }

        let endChar = startChar;
        for (let j = conflictStart; j <= i; j++) {
          endChar += lines[j].length + 1;
        }

        regions.push({
          start: startChar,
          separator: separatorIdx,
          end: endChar,
          ours: oursLines.join('\n'),
          theirs: theirsLines.join('\n')
        });

        inOurs = false;
        inTheirs = false;
        conflictStart = -1;
        separatorIdx = -1;
      } else if (inOurs) {
        oursLines.push(line);
      } else if (inTheirs) {
        theirsLines.push(line);
      }
    }

    return regions;
  }
}
