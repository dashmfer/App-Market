import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in to verify repository ownership" },
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

    // Get the user's GitHub access token from their account
    // This requires the user to have signed in with GitHub
    const account = await prisma?.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "github",
      },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { 
          verified: false, 
          error: "Please sign in with GitHub to verify repository ownership" 
        },
        { status: 400 }
      );
    }

    // Check if the user has access to this repository
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!repoResponse.ok) {
      return NextResponse.json(
        { 
          verified: false, 
          error: "Repository not found or you don't have access" 
        },
        { status: 400 }
      );
    }

    const repoData = await repoResponse.json();

    // Check if the user is the owner or has admin permissions
    const permissionsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/collaborators/${repoData.owner.login}/permission`,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    // Get repository stats
    const contentsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents`,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    let fileCount = 0;
    if (contentsResponse.ok) {
      const contents = await contentsResponse.json();
      fileCount = Array.isArray(contents) ? contents.length : 0;
    }

    // Get commit activity for lines estimate
    const commitsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/vnd.github.v3+json",
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

    // Check if user is owner or has admin/write access
    const isOwner = repoData.owner.login.toLowerCase() === session.user.name?.toLowerCase() ||
                    repoData.permissions?.admin === true ||
                    repoData.permissions?.push === true;

    if (!isOwner) {
      return NextResponse.json(
        { 
          verified: false, 
          error: "You must be the owner or have write access to this repository" 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      verified: true,
      stats: {
        files: fileCount,
        lines: repoData.size * 10, // Rough estimate based on repo size
        lastUpdated,
      },
    });

  } catch (error) {
    console.error("GitHub verification error:", error);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
