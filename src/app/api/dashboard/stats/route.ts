import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/db/mongodb';
import { User } from '@/db/models/User';
import { Assignment } from '@/db/models/Assignment';
import { Submission } from '@/db/models/Submission';
import { Notice } from '@/db/models/Notice';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

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

    // Get user details using Mongoose
    const user = await User.findById(decoded.userId).exec();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 401 }
      );
    }

    const today = new Date().toISOString();

    // STUDENT ROLE
    if (user.role === 'student') {
      // Count total assignments in student's department
      const totalAssignments = await Assignment.countDocuments({ 
        department: user.department 
      }).exec();

      // Count submitted assignments by this student
      const submittedAssignments = await Submission.countDocuments({ 
        studentId: user._id 
      }).exec();

      // Calculate pending assignments
      const pendingAssignments = totalAssignments - submittedAssignments;

      // Get recent notices from student's department
      const recentNotices = await Notice.find({ 
        department: user.department 
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();

      // Get upcoming assignments from student's department
      const upcomingAssignments = await Assignment.find({
        department: user.department,
        dueDate: { $gte: today }
      })
        .sort({ dueDate: 1 })
        .limit(3)
        .lean()
        .exec();

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
      const totalAssignments = await Assignment.countDocuments({ 
        createdBy: user._id 
      }).exec();

      // Count total submissions across all their assignments
      const facultyAssignments = await Assignment.find({ 
        createdBy: user._id 
      })
        .select('_id')
        .lean()
        .exec();
      
      const assignmentIds = facultyAssignments.map(a => a._id);
      const totalSubmissions = await Submission.countDocuments({ 
        assignmentId: { $in: assignmentIds } 
      }).exec();

      // Count unique students in their department
      const totalStudents = await User.countDocuments({
        department: user.department,
        role: 'student'
      }).exec();

      // Get recent submissions on their assignments with student details
      const recentSubmissions = await Submission.find({ 
        assignmentId: { $in: assignmentIds } 
      })
        .populate('studentId', 'name email')
        .populate('assignmentId', 'title')
        .sort({ submittedAt: -1 })
        .limit(5)
        .lean()
        .exec();

      const formattedSubmissions = recentSubmissions.map((sub: any) => ({
        id: sub._id.toString(),
        assignmentId: sub.assignmentId._id.toString(),
        studentId: sub.studentId._id.toString(),
        fileUrl: sub.fileUrl,
        submittedAt: sub.submittedAt,
        feedback: sub.feedback,
        createdAt: sub.createdAt,
        studentName: sub.studentId.name,
        studentEmail: sub.studentId.email,
        assignmentTitle: sub.assignmentId.title
      }));

      // Get department notices
      const departmentNotices = await Notice.find({ 
        department: user.department 
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();

      return NextResponse.json({
        role: 'faculty',
        totalAssignments,
        totalSubmissions,
        totalStudents,
        recentSubmissions: formattedSubmissions,
        departmentNotices
      });
    }

    // ADMIN ROLE
    if (user.role === 'admin') {
      // Count total users
      const totalUsers = await User.countDocuments().exec();

      // Count total students
      const totalStudents = await User.countDocuments({ 
        role: 'student' 
      }).exec();

      // Count total faculty
      const totalFaculty = await User.countDocuments({ 
        role: 'faculty' 
      }).exec();

      // Count total assignments
      const totalAssignments = await Assignment.countDocuments().exec();

      // Count total submissions
      const totalSubmissions = await Submission.countDocuments().exec();

      // Count total notices
      const totalNotices = await Notice.countDocuments().exec();

      // Get department breakdown
      const allUsers = await User.find().select('department role').lean().exec();
      const departmentMap: any = {};
      
      for (const u of allUsers) {
        if (!departmentMap[u.department]) {
          departmentMap[u.department] = { studentCount: 0, facultyCount: 0 };
        }
        if (u.role === 'student') {
          departmentMap[u.department].studentCount++;
        } else if (u.role === 'faculty') {
          departmentMap[u.department].facultyCount++;
        }
      }

      const departmentBreakdown = await Promise.all(
        Object.keys(departmentMap).map(async (dept) => {
          const assignmentCount = await Assignment.countDocuments({ 
            department: dept 
          }).exec();
          
          return {
            department: dept,
            studentCount: departmentMap[dept].studentCount,
            facultyCount: departmentMap[dept].facultyCount,
            assignmentCount: assignmentCount
          };
        })
      );

      // Get recent activity (last 10 submissions with details)
      const recentActivity = await Submission.find()
        .populate('studentId', 'name email department')
        .populate('assignmentId', 'title department')
        .sort({ submittedAt: -1 })
        .limit(10)
        .lean()
        .exec();

      const formattedActivity = recentActivity.map((sub: any) => ({
        id: sub._id.toString(),
        assignmentId: sub.assignmentId._id.toString(),
        studentId: sub.studentId._id.toString(),
        fileUrl: sub.fileUrl,
        submittedAt: sub.submittedAt,
        feedback: sub.feedback,
        createdAt: sub.createdAt,
        studentName: sub.studentId.name,
        studentEmail: sub.studentId.email,
        studentDepartment: sub.studentId.department,
        assignmentTitle: sub.assignmentId.title,
        assignmentDepartment: sub.assignmentId.department
      }));

      return NextResponse.json({
        role: 'admin',
        totalUsers,
        totalStudents,
        totalFaculty,
        totalAssignments,
        totalSubmissions,
        totalNotices,
        departmentBreakdown,
        recentActivity: formattedActivity
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