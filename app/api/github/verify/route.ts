import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { withRateLimitAsync } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit to prevent DDoS of external GitHub API via this endpoint
    const rateLimitResult = await (withRateLimitAsync('write', 'github-verify'))(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // Use getAuthToken for JWT-based authentication (works better with credentials provider)
    const token = await getAuthToken(request);

    if (!token?.id) {
      return NextResponse.json(
        { error: "You must be signed in to verify repository" },
        { status: 401 }
      );
    }

    const { owner, repo } = await request.json();

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo are required" },
        { status: 400 }
      );
    }

    // Use public GitHub API to check if repo exists and is accessible
    // This doesn't require OAuth - works for public repos
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          // Use GitHub token from env if available for higher rate limits
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      }
    );

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        return NextResponse.json(
          {
            verified: false,
            error: "Repository not found. Make sure it's a public repository."
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          verified: false,
          error: "Could not access repository. Please try again."
        },
        { status: 400 }
      );
    }

    const repoData = await repoResponse.json();

    // Get repository contents for file count
    const contentsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      }
    );

    let fileCount = 0;
    if (contentsResponse.ok) {
      const contents = await contentsResponse.json();
      fileCount = Array.isArray(contents) ? contents.length : 0;
    }

    // Get last commit for update time
    const commitsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      }
    );

    let lastUpdated = "Unknown";
    if (commitsResponse.ok) {
      const commits = await commitsResponse.json();
      if (commits.length > 0) {
        const commitDate = new Date(commits[0].commit.committer.date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          lastUpdated = "Today";
        } else if (diffDays === 1) {
          lastUpdated = "Yesterday";
        } else if (diffDays < 7) {
          lastUpdated = `${diffDays} days ago`;
        } else if (diffDays < 30) {
          lastUpdated = `${Math.floor(diffDays / 7)} weeks ago`;
        } else {
          lastUpdated = `${Math.floor(diffDays / 30)} months ago`;
        }
      }
    }

    // For public repos, we consider them "verified" if they exist
    // The actual ownership verification happens during the escrow/transfer process
    return NextResponse.json({
      verified: true,
      stats: {
        files: fileCount,
        lines: repoData.size * 10, // Rough estimate based on repo size
        lastUpdated,
      },
      note: "Repository found. Ownership will be verified during the transfer process.",
    });

  } catch (error) {
    console.error("GitHub verification error:", error);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
