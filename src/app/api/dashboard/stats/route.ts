import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/db';
import { users, assignments, submissions, notices } from '@/db/schema';
import { eq, and, gte, sql, desc, asc } from 'drizzle-orm';

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_TOKEN' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      ) as JWTPayload;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    // Get user details
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 401 }
      );
    }

    const user = userResult[0];
    const today = new Date().toISOString();

    // STUDENT ROLE
    if (user.role === 'student') {
      // Count total assignments in student's department
      const totalAssignmentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(assignments)
        .where(eq(assignments.department, user.department));
      const totalAssignments = Number(totalAssignmentsResult[0]?.count || 0);

      // Count submitted assignments by this student
      const submittedAssignmentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissions)
        .where(eq(submissions.studentId, user.id));
      const submittedAssignments = Number(submittedAssignmentsResult[0]?.count || 0);

      // Calculate pending assignments
      const pendingAssignments = totalAssignments - submittedAssignments;

      // Get recent notices from student's department
      const recentNotices = await db
        .select()
        .from(notices)
        .where(eq(notices.department, user.department))
        .orderBy(desc(notices.createdAt))
        .limit(5);

      // Get upcoming assignments from student's department
      const upcomingAssignments = await db
        .select()
        .from(assignments)
        .where(
          and(
            eq(assignments.department, user.department),
            gte(assignments.dueDate, today)
          )
        )
        .orderBy(asc(assignments.dueDate))
        .limit(3);

      return NextResponse.json({
        role: 'student',
        totalAssignments,
        submittedAssignments,
        pendingAssignments,
        recentNotices,
        upcomingAssignments
      });
    }

    // FACULTY ROLE
    if (user.role === 'faculty') {
      // Count total assignments created by this faculty
      const totalAssignmentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(assignments)
        .where(eq(assignments.createdBy, user.id));
      const totalAssignments = Number(totalAssignmentsResult[0]?.count || 0);

      // Count total submissions across all their assignments
      const totalSubmissionsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .where(eq(assignments.createdBy, user.id));
      const totalSubmissions = Number(totalSubmissionsResult[0]?.count || 0);

      // Count unique students in their department
      const totalStudentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            eq(users.department, user.department),
            eq(users.role, 'student')
          )
        );
      const totalStudents = Number(totalStudentsResult[0]?.count || 0);

      // Get recent submissions on their assignments with student details
      const recentSubmissions = await db
        .select({
          id: submissions.id,
          assignmentId: submissions.assignmentId,
          studentId: submissions.studentId,
          fileUrl: submissions.fileUrl,
          submittedAt: submissions.submittedAt,
          feedback: submissions.feedback,
          createdAt: submissions.createdAt,
          studentName: users.name,
          studentEmail: users.email,
          assignmentTitle: assignments.title
        })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .innerJoin(users, eq(submissions.studentId, users.id))
        .where(eq(assignments.createdBy, user.id))
        .orderBy(desc(submissions.submittedAt))
        .limit(5);

      // Get department notices
      const departmentNotices = await db
        .select()
        .from(notices)
        .where(eq(notices.department, user.department))
        .orderBy(desc(notices.createdAt))
        .limit(5);

      return NextResponse.json({
        role: 'faculty',
        totalAssignments,
        totalSubmissions,
        totalStudents,
        recentSubmissions,
        departmentNotices
      });
    }

    // ADMIN ROLE
    if (user.role === 'admin') {
      // Count total users
      const totalUsersResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users);
      const totalUsers = Number(totalUsersResult[0]?.count || 0);

      // Count total students
      const totalStudentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, 'student'));
      const totalStudents = Number(totalStudentsResult[0]?.count || 0);

      // Count total faculty
      const totalFacultyResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, 'faculty'));
      const totalFaculty = Number(totalFacultyResult[0]?.count || 0);

      // Count total assignments
      const totalAssignmentsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(assignments);
      const totalAssignments = Number(totalAssignmentsResult[0]?.count || 0);

      // Count total submissions
      const totalSubmissionsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissions);
      const totalSubmissions = Number(totalSubmissionsResult[0]?.count || 0);

      // Count total notices
      const totalNoticesResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(notices);
      const totalNotices = Number(totalNoticesResult[0]?.count || 0);

      // Get department breakdown
      const departmentBreakdownRaw = await db
        .select({
          department: users.department,
          studentCount: sql<number>`sum(case when ${users.role} = 'student' then 1 else 0 end)`,
          facultyCount: sql<number>`sum(case when ${users.role} = 'faculty' then 1 else 0 end)`
        })
        .from(users)
        .groupBy(users.department);

      const departmentBreakdown = await Promise.all(
        departmentBreakdownRaw.map(async (dept) => {
          const assignmentCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(assignments)
            .where(eq(assignments.department, dept.department));
          
          return {
            department: dept.department,
            studentCount: Number(dept.studentCount || 0),
            facultyCount: Number(dept.facultyCount || 0),
            assignmentCount: Number(assignmentCountResult[0]?.count || 0)
          };
        })
      );

      // Get recent activity (last 10 submissions with details)
      const recentActivity = await db
        .select({
          id: submissions.id,
          assignmentId: submissions.assignmentId,
          studentId: submissions.studentId,
          fileUrl: submissions.fileUrl,
          submittedAt: submissions.submittedAt,
          feedback: submissions.feedback,
          createdAt: submissions.createdAt,
          studentName: users.name,
          studentEmail: users.email,
          studentDepartment: users.department,
          assignmentTitle: assignments.title,
          assignmentDepartment: assignments.department
        })
        .from(submissions)
        .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
        .innerJoin(users, eq(submissions.studentId, users.id))
        .orderBy(desc(submissions.submittedAt))
        .limit(10);

      return NextResponse.json({
        role: 'admin',
        totalUsers,
        totalStudents,
        totalFaculty,
        totalAssignments,
        totalSubmissions,
        totalNotices,
        departmentBreakdown,
        recentActivity
      });
    }

    // Unknown role
    return NextResponse.json(
      { error: 'Invalid user role', code: 'INVALID_ROLE' },
      { status: 401 }
    );

  } catch (error) {
    console.error('GET dashboard statistics error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}